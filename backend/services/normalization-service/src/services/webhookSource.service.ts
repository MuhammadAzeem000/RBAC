import { randomBytes } from "crypto";
import { forTenant } from "@responderx/shared";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";
import { writeOutboxEvent } from "./outbox.service";

const TENANT_SCOPED_MODELS = ["WebhookSource", "OutboxEvent"] as const;

// Same "build a scoped client from a resolved tenantId" pattern used by
// every other M2M/no-request-context caller in this codebase (e.g.
// incident-service's temporal/activities.ts, events/alertConsumer.ts) —
// here, the receiver (controllers/normalize.controller.ts) resolves
// tenantId from the webhook token, not a JWT, so there's no tenantContext
// middleware to have already attached req.db.
export function scopedDb(tenantId: bigint) {
  return forTenant(prisma, tenantId, TENANT_SCOPED_MODELS);
}

export interface WebhookSourceResponse {
  id: bigint;
  vendor: string;
  label: string;
  token: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const webhookSourceSelect = {
  id: true,
  vendor: true,
  label: true,
  token: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

export interface CreateWebhookSourceInput {
  vendor: string;
  label: string;
}

export async function createWebhookSource(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  input: CreateWebhookSourceInput,
  actorUserId: bigint,
): Promise<WebhookSourceResponse> {
  return db.$transaction(async (tx) => {
    const source = await tx.webhookSource.create({
      data: {
        tenantId,
        vendor: input.vendor,
        label: input.label,
        token: randomBytes(32).toString("hex"),
        createdBy: actorUserId,
      },
      select: webhookSourceSelect,
    });

    await writeOutboxEvent(tx, {
      tenantId,
      eventType: "WEBHOOK_SOURCE_CREATED",
      aggregateType: "WEBHOOK_SOURCE",
      aggregateId: source.id.toString(),
      actorId: actorUserId.toString(),
      action: "CREATE",
      resourceType: "WEBHOOK_SOURCE",
      resourceId: source.id.toString(),
      metadata: { vendor: input.vendor, label: input.label },
      // Never the token itself — same "record that a secret was set,
      // never the secret" convention as integration-service's
      // CONNECTOR_CREDENTIALS_SET event.
    });

    return source;
  });
}

export function listWebhookSources(db: Prisma.TransactionClient): Promise<WebhookSourceResponse[]> {
  return db.webhookSource.findMany({ select: webhookSourceSelect, orderBy: { createdAt: "desc" } });
}

export interface ResolvedWebhookSource {
  id: bigint;
  tenantId: bigint;
  vendor: string;
}

// Deliberately NOT tenant-scoped via forTenant() — the tenant isn't known
// until AFTER this lookup resolves it, so it queries the plain (unscoped)
// prisma client directly by the token's own uniqueness. This is the one
// place in this service that reads WebhookSource outside req.db.
export async function lookupByToken(token: string): Promise<ResolvedWebhookSource | null> {
  const source = await prisma.webhookSource.findUnique({ where: { token }, select: { id: true, tenantId: true, vendor: true } });
  if (!source) return null;
  await prisma.webhookSource.update({ where: { id: source.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return source;
}
