import { randomUUID } from "crypto";
import { Prisma } from "../generated/prisma/client";

export interface AuditEventInput {
  tenantId: bigint;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorId: string | null;
  actorType?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

type TxClient = Prisma.TransactionClient;

/**
 * Writes an outbox row inside the CALLER's transaction — this function never
 * opens its own transaction, so it only ever commits or rolls back together
 * with whatever business write the caller is also making in `tx`. Only
 * called for the mutations this service centrally audits (incident
 * create/update/status/severity/assignment/close, playbook run approval) —
 * TimelineEvent remains the audit trail for everything else (tasks,
 * evidence, comments, playbook run start/completion).
 *
 * tenantId is always passed explicitly rather than left to the
 * tenant-scoping extension's create-time auto-stamp, since Prisma's
 * generated type requires it regardless of whether `tx` happens to be
 * scoped (see incident.service.ts::createIncident for the same reasoning).
 */
export function writeOutboxEvent(tx: TxClient, input: AuditEventInput): Promise<void> {
  return tx.outboxEvent
    .create({
      data: {
        tenantId: input.tenantId,
        eventId: randomUUID(),
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        actorId: input.actorId,
        actorType: input.actorType ?? "USER",
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        payload: input.payload as Prisma.InputJsonValue | undefined,
      },
    })
    .then(() => undefined);
}
