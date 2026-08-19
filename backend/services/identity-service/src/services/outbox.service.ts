import { randomUUID } from "crypto";
import { Prisma } from "../generated/prisma/client";

export interface AuditEventInput {
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
 * with whatever business write the caller is also making in `tx`. This is
 * the entire correctness property the transactional outbox pattern rests
 * on: never call this outside a `prisma.$transaction(async (tx) => ...)`
 * that also contains the business mutation being audited.
 */
export function writeOutboxEvent(tx: TxClient, input: AuditEventInput): Promise<void> {
  return tx.outboxEvent
    .create({
      data: {
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
