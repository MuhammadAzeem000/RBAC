import { Prisma } from "../generated/prisma/client";
import { TenantScopedPrisma } from "../middlewares/tenantContext";
import { StixEnvelopeObject } from "../lib/taxiiClient";
import { parseStixPattern } from "../lib/stixPatternParser";
import * as outboxService from "./outbox.service";

export interface IngestContext {
  tenantId: bigint;
  taxiiServerId: bigint;
  taxiiCollectionId: bigint;
  sourceFeedName: string;
}

function asDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Upserts one STIX 2.1 object into the polymorphic StixObject store
 * (keyed on [tenantId, stixId], so a later poll of an updated/revoked object
 * updates the row rather than duplicating), and — for `indicator` objects
 * only — writes an audit + domain-event outbox row in the SAME transaction,
 * so ingestion and eventing can never diverge. Identical pattern to
 * integration-service's ActionResult + outbox writes.
 */
export async function ingestStixObject(
  db: TenantScopedPrisma,
  object: StixEnvelopeObject,
  ctx: IngestContext,
): Promise<void> {
  const parsedPattern = object.type === "indicator" ? parseStixPattern(object.pattern as string | undefined) : null;

  await db.$transaction(async (tx) => {
    const row = await tx.stixObject.upsert({
      where: { tenantId_stixId: { tenantId: ctx.tenantId, stixId: object.id } },
      update: {
        type: object.type,
        specVersion: object.spec_version ?? "2.1",
        iocType: parsedPattern?.iocType ?? null,
        iocValue: parsedPattern?.iocValue ?? null,
        pattern: (object.pattern as string | undefined) ?? null,
        labels: asStringArray(object.labels),
        confidence: typeof object.confidence === "number" ? object.confidence : null,
        firstSeen: asDate(object.valid_from ?? object.first_seen),
        lastSeen: asDate(object.valid_until ?? object.last_seen),
        revoked: object.revoked === true,
        raw: object as unknown as Prisma.InputJsonValue,
        taxiiServerId: ctx.taxiiServerId,
        taxiiCollectionId: ctx.taxiiCollectionId,
        sourceFeedName: ctx.sourceFeedName,
      },
      create: {
        tenantId: ctx.tenantId,
        stixId: object.id,
        type: object.type,
        specVersion: object.spec_version ?? "2.1",
        iocType: parsedPattern?.iocType ?? null,
        iocValue: parsedPattern?.iocValue ?? null,
        pattern: (object.pattern as string | undefined) ?? null,
        labels: asStringArray(object.labels),
        confidence: typeof object.confidence === "number" ? object.confidence : null,
        firstSeen: asDate(object.valid_from ?? object.first_seen),
        lastSeen: asDate(object.valid_until ?? object.last_seen),
        revoked: object.revoked === true,
        raw: object as unknown as Prisma.InputJsonValue,
        taxiiServerId: ctx.taxiiServerId,
        taxiiCollectionId: ctx.taxiiCollectionId,
        sourceFeedName: ctx.sourceFeedName,
      },
    });

    if (object.type !== "indicator") return;

    await outboxService.writeOutboxEvent(tx, {
      tenantId: ctx.tenantId,
      eventType: "IOC_INGESTED",
      aggregateType: "STIX_OBJECT",
      aggregateId: row.id.toString(),
      actorId: null,
      action: "INGEST",
      resourceType: "STIX_OBJECT",
      resourceId: row.id.toString(),
      metadata: {
        stixId: object.id,
        iocType: parsedPattern?.iocType ?? null,
        iocValue: parsedPattern?.iocValue ?? null,
        labels: asStringArray(object.labels),
        sourceFeedName: ctx.sourceFeedName,
      },
    });
  });
}
