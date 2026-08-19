/**
 * One-time migration: copies every row from identity-service's old
 * `audit_logs` table (rbac_db) into this service's own `audit_logs` table
 * (audit_db). Run once, manually, after audit-service is deployed and
 * before identity-service's old audit code is removed:
 *
 *   npx tsx scripts/backfill-from-identity.ts
 *
 * Reads the source database directly via `pg` (not identity-service's
 * Prisma client — no cross-service dependency needed for a read-only,
 * one-off script) using the SAME DB_* credentials this service already has
 * (same Postgres server, different database), overridable via
 * SOURCE_DB_NAME / SOURCE_DB_HOST / SOURCE_DB_PORT / SOURCE_DB_USER /
 * SOURCE_DB_PASSWORD if the old database lives somewhere else.
 *
 * Idempotent: assigns a fresh, deterministic-per-row eventId derived from
 * the old row's id (so re-running this script never creates duplicates —
 * the same unique-eventId upsert the live consumer relies on applies here
 * too).
 */
import "dotenv/config";
import { createHash } from "crypto";
import { Client } from "pg";
import { prisma } from "../src/config/prisma";
import { Prisma } from "../src/generated/prisma/client";

interface OldAuditLogRow {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: unknown;
  created_at: Date;
}

function deterministicEventId(oldId: string): string {
  // Not a real UUID — a stable 36-char idempotency key derived from the old
  // row's id, in the same unique(eventId) slot every other event uses, so
  // re-running this script is a safe no-op.
  // "legacy-" (7 chars) + 29 hex chars = 36, matching the eventId column's
  // db.VarChar(36) exactly.
  const hash = createHash("sha1").update(`identity-service:audit_logs:${oldId}`).digest("hex");
  return `legacy-${hash.slice(0, 29)}`;
}

function deriveEventType(action: string): string {
  // Old format was "<targetType>.<verb>", e.g. "user.create" -> "USER_CREATE".
  return action.toUpperCase().replace(/\./g, "_");
}

function deriveVerb(action: string): string {
  const verb = action.split(".").pop() ?? action;
  return verb.toUpperCase();
}

async function main() {
  const sourceClient = new Client({
    host: process.env.SOURCE_DB_HOST ?? process.env.DB_HOST,
    port: Number(process.env.SOURCE_DB_PORT ?? process.env.DB_PORT ?? 5432),
    user: process.env.SOURCE_DB_USER ?? process.env.DB_USER,
    password: process.env.SOURCE_DB_PASSWORD ?? process.env.DB_PASSWORD,
    database: process.env.SOURCE_DB_NAME ?? "rbac_db",
  });

  await sourceClient.connect();
  console.log("Connected to source database, reading legacy audit_logs…");

  const { rows } = await sourceClient.query<OldAuditLogRow>(
    "SELECT id, actor_user_id, action, target_type, target_id, metadata, created_at FROM audit_logs ORDER BY id ASC",
  );
  console.log(`Found ${rows.length} legacy audit log rows.`);

  let migrated = 0;
  let alreadyPresent = 0;

  for (const row of rows) {
    const eventId = deterministicEventId(row.id);
    const existing = await prisma.auditLog.findUnique({ where: { eventId } });
    if (existing) {
      alreadyPresent++;
      continue;
    }

    await prisma.auditLog.create({
      data: {
        eventId,
        eventType: deriveEventType(row.action),
        service: "identity-service",
        actorId: row.actor_user_id,
        actorType: "USER",
        action: deriveVerb(row.action),
        resourceType: row.target_type.toUpperCase(),
        resourceId: row.target_id ?? "unknown",
        metadata: undefined,
        payload: (row.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        occurredAt: row.created_at,
      },
    });
    migrated++;
  }

  console.log(`Migrated ${migrated} rows (${alreadyPresent} already present from a prior run).`);

  await sourceClient.end();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
