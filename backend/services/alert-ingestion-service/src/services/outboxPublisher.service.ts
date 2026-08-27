import amqplib, { ConfirmChannel } from "amqplib";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AUDIT_EXCHANGE } from "../events/auditTopology";
import { ALERT_EXCHANGE, ALERT_INGESTED_ROUTING_KEY } from "../events/alertTopology";

const SERVICE_NAME = "alert-ingestion-service";
const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 20;
const CONNECT_RETRY_DELAY_MS = 5000;

// Event types that need to reach the incident-creation saga, not just the
// audit trail — see the dual-publish comment in publishBatch() below.
const SAGA_EVENT_ROUTING_KEYS: Record<string, string> = {
  ALERT_INGESTED: ALERT_INGESTED_ROUTING_KEY,
};

let confirmChannel: ConfirmChannel | null = null;
let connecting = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Uses a CONFIRM channel, not a plain one — publish() only resolves once
// the broker has actually accepted the message. Asserts BOTH exchanges up
// front so a row needing the saga fan-out never fails because the second
// exchange wasn't declared yet.
async function connectPublisher(): Promise<void> {
  if (connecting) return;
  connecting = true;

  for (;;) {
    try {
      const connection = await amqplib.connect(env.RABBITMQ_URL);
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });
      await channel.assertExchange(ALERT_EXCHANGE, "topic", { durable: true });

      confirmChannel = channel;
      connection.on("close", () => {
        console.warn("Outbox publisher: RabbitMQ connection closed, reconnecting…");
        confirmChannel = null;
        connecting = false;
        void connectPublisher();
      });
      connection.on("error", (error) => {
        console.warn("Outbox publisher: RabbitMQ connection error:", error);
      });

      console.log("Outbox publisher connected to RabbitMQ");
      return;
    } catch (error) {
      console.warn(`Outbox publisher connection failed, retrying in ${CONNECT_RETRY_DELAY_MS}ms:`, error);
      await sleep(CONNECT_RETRY_DELAY_MS);
    }
  }
}

interface ClaimedRow {
  id: bigint;
  tenant_id: bigint;
  event_id: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  metadata: unknown;
  payload: unknown;
  created_at: Date;
}

/**
 * Claims a batch of unpublished rows using Postgres's own row-locking
 * (`FOR UPDATE SKIP LOCKED`) inside one transaction — safe to run more than
 * one instance of this worker at once.
 */
async function claimBatch(): Promise<ClaimedRow[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      SELECT id, tenant_id, event_id, event_type, resource_type, resource_id, actor_id, actor_type,
             action, metadata, payload, created_at
      FROM outbox_events
      WHERE published_at IS NULL
      ORDER BY created_at
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    await tx.outboxEvent.updateMany({ where: { id: { in: ids } }, data: { attempts: { increment: 1 } } });
    return rows;
  });
}

function publishConfirmed(channel: ConfirmChannel, exchange: string, routingKey: string, body: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.publish(exchange, routingKey, body, { persistent: true, contentType: "application/json" }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function publishBatch(): Promise<void> {
  if (!confirmChannel) return;

  const rows = await claimBatch();
  for (const row of rows) {
    const message = {
      eventId: row.event_id,
      eventType: row.event_type,
      tenantId: row.tenant_id.toString(),
      timestamp: row.created_at.toISOString(),
      service: SERVICE_NAME,
      actorId: row.actor_id,
      actorType: row.actor_type,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: row.metadata ?? undefined,
      payload: row.payload ?? undefined,
    };
    const body = Buffer.from(JSON.stringify(message));
    const auditRoutingKey = `${SERVICE_NAME}.${row.resource_type.toLowerCase()}.${row.action.toLowerCase()}`;

    try {
      await publishConfirmed(confirmChannel, AUDIT_EXCHANGE, auditRoutingKey, body);

      // One outbox row, fanned out to a second exchange for the specific
      // event types the incident-creation saga depends on — same durable
      // row, same confirm-channel guarantee, same retry-on-failure below
      // (if EITHER publish throws, the row stays unpublished and the whole
      // thing is retried next poll — never marked done with only one side
      // delivered).
      const sagaRoutingKey = SAGA_EVENT_ROUTING_KEYS[row.event_type];
      if (sagaRoutingKey) {
        await publishConfirmed(confirmChannel, ALERT_EXCHANGE, sagaRoutingKey, body);
      }

      await prisma.outboxEvent.update({ where: { id: row.id }, data: { publishedAt: new Date(), lastError: null } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Outbox publish failed for event ${row.event_id}:`, error);
      await prisma.outboxEvent.update({ where: { id: row.id }, data: { lastError: errorMessage } }).catch(() => {});
    }
  }
}

export function startOutboxPublisher(): void {
  void connectPublisher();
  pollTimer = setInterval(() => {
    void publishBatch().catch((error) => console.error("Outbox publisher poll failed:", error));
  }, POLL_INTERVAL_MS);
}

export function stopOutboxPublisher(): void {
  if (pollTimer) clearInterval(pollTimer);
}
