import { forTenant } from "@responderx/shared";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { IngestAlertRequest } from "../interfaces/ingestion";
import { writeOutboxEvent } from "./outbox.service";

const TENANT_SCOPED_MODELS = ["Alert", "Entity", "OutboxEvent"] as const;

function scopedDb(tenantId: bigint) {
  return forTenant(prisma, tenantId, TENANT_SCOPED_MODELS);
}

export interface EntityResponse {
  id: bigint;
  type: string;
  value: string;
  confidence: number | null;
  attributes: unknown;
}

export interface AlertResponse {
  id: bigint;
  tenantId: bigint;
  externalAlertId: string;
  source: string;
  summary: string | null;
  severity: string | null;
  occurredAt: Date | null;
  rawRef: string | null;
  status: string;
  incidentId: bigint | null;
  errorMessage: string | null;
  attachedBy: bigint;
  attachedAt: Date;
  entities: EntityResponse[];
}

const alertSelect = {
  id: true,
  tenantId: true,
  externalAlertId: true,
  source: true,
  summary: true,
  severity: true,
  occurredAt: true,
  rawRef: true,
  status: true,
  incidentId: true,
  errorMessage: true,
  attachedBy: true,
  attachedAt: true,
  entities: {
    select: { id: true, type: true, value: true, confidence: true, attributes: true },
  },
} as const;

function synthesizeSummary(input: IngestAlertRequest): string {
  const entityNote =
    input.entities.length > 0 ? `, ${input.entities.length} entit${input.entities.length === 1 ? "y" : "ies"}` : "";
  return `${input.source} alert (severity: ${input.severity}${entityNote})`;
}

// The attach path's ONLY cross-service call is this read — forwarding the
// caller's own bearer token, no saga, no service-token. Losing/failing this
// call just fails the attach request visibly (409/404), it can't leave
// anything inconsistent the way a failed WRITE could.
async function verifyIncidentExists(token: string, incidentId: string): Promise<boolean> {
  const response = await fetch(`${env.INCIDENT_SERVICE_URL}/api/v1/incidents/${incidentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

export interface IngestAlertResult {
  alert: AlertResponse;
  mode: "attached" | "pending" | "deduped";
}

export async function ingestAlert(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  token: string,
  input: IngestAlertRequest,
  actorUserId: bigint,
): Promise<IngestAlertResult> {
  const existing = await db.alert.findFirst({
    where: { source: input.source, externalAlertId: input.externalId },
    select: alertSelect,
  });
  if (existing) {
    return { alert: existing, mode: "deduped" };
  }

  if (input.incidentId) {
    const exists = await verifyIncidentExists(token, input.incidentId);
    if (!exists) {
      throw new HttpError(404, `Incident ${input.incidentId} not found`);
    }

    const alert = await db.$transaction(async (tx) => {
      const created = await tx.alert.create({
        data: {
          tenantId,
          externalAlertId: input.externalId,
          source: input.source,
          summary: synthesizeSummary(input),
          severity: input.severity,
          occurredAt: new Date(input.timestamp),
          rawRef: input.rawRef,
          status: "attached",
          incidentId: BigInt(input.incidentId!),
          attachedBy: actorUserId,
        },
        select: { id: true },
      });

      if (input.entities.length > 0) {
        await tx.entity.createMany({
          data: input.entities.map((entity) => ({
            tenantId,
            alertId: created.id,
            type: entity.type,
            value: entity.value,
            confidence: entity.confidence,
            attributes: entity.attributes as Prisma.InputJsonValue | undefined,
          })),
        });
      }

      return tx.alert.findFirstOrThrow({ where: { id: created.id }, select: alertSelect });
    });

    return { alert, mode: "attached" };
  }

  const alert = await db.$transaction(async (tx) => {
    const created = await tx.alert.create({
      data: {
        tenantId,
        externalAlertId: input.externalId,
        source: input.source,
        summary: synthesizeSummary(input),
        severity: input.severity,
        occurredAt: new Date(input.timestamp),
        rawRef: input.rawRef,
        status: "pending_case",
        attachedBy: actorUserId,
      },
      select: { id: true },
    });

    if (input.entities.length > 0) {
      await tx.entity.createMany({
        data: input.entities.map((entity) => ({
          tenantId,
          alertId: created.id,
          type: entity.type,
          value: entity.value,
          confidence: entity.confidence,
          attributes: entity.attributes as Prisma.InputJsonValue | undefined,
        })),
      });
    }

    // Guaranteed-delivery handoff to incident-service (see
    // outboxPublisher.service.ts's dual-publish) — the whole point of using
    // the outbox here instead of a fire-and-forget domain event is that
    // losing this would mean the alert silently never becomes a case.
    await writeOutboxEvent(tx, {
      tenantId,
      eventType: "ALERT_INGESTED",
      aggregateType: "ALERT",
      aggregateId: created.id.toString(),
      actorId: actorUserId.toString(),
      action: "INGEST",
      resourceType: "ALERT",
      resourceId: created.id.toString(),
      payload: {
        alertId: created.id.toString(),
        requestorId: actorUserId.toString(),
        source: input.source,
        externalId: input.externalId,
        severity: input.severity,
        timestamp: input.timestamp,
        triggerPlaybookKey: input.triggerPlaybookKey,
      },
    });

    return tx.alert.findFirstOrThrow({ where: { id: created.id }, select: alertSelect });
  });

  return { alert, mode: "pending" };
}

export function getAlertById(db: Prisma.TransactionClient, id: bigint): Promise<AlertResponse | null> {
  return db.alert.findFirst({ where: { id }, select: alertSelect });
}

// The frontend's "alerts attached to this incident" panel needs this —
// incident-service no longer holds any Alert rows to list itself.
export function listAlertsByIncident(db: Prisma.TransactionClient, incidentId: bigint): Promise<AlertResponse[]> {
  return db.alert.findMany({ where: { incidentId }, select: alertSelect, orderBy: { attachedAt: "desc" } });
}

// Called by events/consumer.ts on INCIDENT_CREATED_FOR_ALERT — builds its
// own tenant-scoped client since a consumer has no req/req.db to inherit,
// same pattern incident-service's Temporal activities already use.
export async function linkAlertToIncident(alertId: bigint, tenantId: bigint, incidentId: bigint): Promise<void> {
  const db = scopedDb(tenantId);
  await db.alert.update({ where: { id: alertId }, data: { status: "linked", incidentId, errorMessage: null } });
}

// Called by events/consumer.ts on INCIDENT_CREATE_FAILED.
export async function markAlertFailed(alertId: bigint, tenantId: bigint, reason: string): Promise<void> {
  const db = scopedDb(tenantId);
  await db.alert.update({ where: { id: alertId }, data: { status: "failed", errorMessage: reason } });
}
