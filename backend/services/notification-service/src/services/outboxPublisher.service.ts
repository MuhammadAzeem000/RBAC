import amqplib, { ConfirmChannel } from "amqplib";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AUDIT_EXCHANGE } from "../events/auditTopology";

const SERVICE_NAME = "notification-service";
const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 20;
const CONNECT_RETRY_DELAY_MS = 5000;

let confirmChannel: ConfirmChannel | null = null;
let connecting = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectPublisher(): Promise<void> {
  if (connecting) return;
  connecting = true;

  for (;;) {
    try {
      const connection = await amqplib.connect(env.RABBITMQ_URL);
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });

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

async function claimBatch(): Promise<ClaimedRow[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      SELECT id, event_id, event_type, resource_type, resource_id, actor_id, actor_type,
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

function publishConfirmed(channel: ConfirmChannel, routingKey: string, body: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.publish(AUDIT_EXCHANGE, routingKey, body, { persistent: true, contentType: "application/json" }, (err) => {
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
    const routingKey = `${SERVICE_NAME}.${row.resource_type.toLowerCase()}.${row.action.toLowerCase()}`;

    try {
      await publishConfirmed(confirmChannel, routingKey, Buffer.from(JSON.stringify(message)));
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
