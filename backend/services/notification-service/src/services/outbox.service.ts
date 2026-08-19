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
 * Writes an outbox row inside the CALLER's transaction — never opens its own
 * transaction, so it only ever commits or rolls back together with the
 * Notification row it's always paired with (see rabbitmq/consumer.ts).
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
        actorType: input.actorType ?? "SYSTEM",
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        payload: input.payload as Prisma.InputJsonValue | undefined,
      },
    })
    .then(() => undefined);
}
