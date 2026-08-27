import { Prisma } from "../generated/prisma/client";
import { IngestAlertRequest } from "../interfaces/ingestion";
import { IncidentResponse } from "../interfaces/incident";
import { AlertResponse } from "../interfaces/alert-response";
import { createIncidentInTx, getIncidentById } from "./incident.service";
import { alertSelect } from "./alert.service";

export interface IngestAlertResult {
  incident: IncidentResponse;
  alert: AlertResponse;
  deduped: boolean;
}

function synthesizeSummary(input: IngestAlertRequest): string {
  const entityNote = input.entities.length > 0 ? `, ${input.entities.length} entit${input.entities.length === 1 ? "y" : "ies"}` : "";
  return `${input.source} alert (severity: ${input.severity}${entityNote})`;
}

function synthesizeTitle(input: IngestAlertRequest): string {
  return `${input.source} alert ${input.externalId}`;
}

// Idempotency, not correlation: the same (source, externalId) arriving
// twice (a webhook retry, a duplicate delivery) returns the existing
// incident/alert rather than creating a second one. It does NOT search for
// or merge into some OTHER related-but-different incident — that's a real
// correlation engine, a different and much bigger feature this endpoint
// isn't attempting (see the Phase 5 plan's "explicitly not in this pass").
export async function ingestAlert(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  input: IngestAlertRequest,
  actorUserId: bigint,
): Promise<IngestAlertResult> {
  const existing = await db.alert.findFirst({
    where: { source: input.source, externalAlertId: input.externalId },
    select: alertSelect,
  });
  if (existing) {
    const incident = await getIncidentById(db, existing.incidentId);
    // The FK guarantees the incident exists — a null here would mean the
    // schema's own referential integrity broke, not a normal "not found".
    return { incident: incident!, alert: existing, deduped: true };
  }

  const { incident, alert } = await db.$transaction(async (tx) => {
    const incident = await createIncidentInTx(
      tx,
      tenantId,
      {
        title: synthesizeTitle(input),
        severity: input.severity,
        source: input.source,
        externalId: input.externalId,
        detectedAt: new Date(input.timestamp),
      },
      actorUserId,
    );

    const created = await tx.alert.create({
      data: {
        tenantId,
        incidentId: incident.id,
        externalAlertId: input.externalId,
        source: input.source,
        summary: synthesizeSummary(input),
        severity: input.severity,
        occurredAt: new Date(input.timestamp),
        rawRef: input.rawRef,
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

    // Re-fetched with the full select (entities included) — the create()
    // above ran before the entities existed, so its own return value would
    // have reported an empty entities array regardless of what was just
    // inserted.
    const alert = await tx.alert.findFirstOrThrow({ where: { id: created.id }, select: alertSelect });

    return { incident, alert };
  });

  return { incident, alert, deduped: false };
}
