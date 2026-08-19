import amqplib, { Channel, ConsumeMessage } from "amqplib";
import { env } from "../config/env";
import { AUDIT_DLQ, AUDIT_DLX, AUDIT_EXCHANGE, AUDIT_QUEUE } from "./topology";
import { AuditEventMessage } from "../interfaces/auditEvent";
import { persistIdempotent } from "../services/auditLog.service";

const RETRY_DELAY_MS = 5000;
const MAX_PROCESSING_ATTEMPTS = 3;
const PROCESSING_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let connecting = false;

// Connects in the background and keeps retrying on failure/drop — never
// blocks server startup and never throws. If RabbitMQ is unreachable when
// this service starts, publishers on the other side just accumulate
// unpublished outbox rows (or, once published, undelivered durable-queue
// messages) until this comes back — nothing here needs to "catch up"
// specially, the queue already holds everything.
export async function connectConsumer(): Promise<void> {
  if (connecting) return;
  connecting = true;

  for (;;) {
    try {
      const connection = await amqplib.connect(env.RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });
      await channel.assertExchange(AUDIT_DLX, "fanout", { durable: true });
      await channel.assertQueue(AUDIT_DLQ, { durable: true });
      await channel.bindQueue(AUDIT_DLQ, AUDIT_DLX, "");
      await channel.assertQueue(AUDIT_QUEUE, {
        durable: true,
        arguments: { "x-dead-letter-exchange": AUDIT_DLX },
      });
      await channel.bindQueue(AUDIT_QUEUE, AUDIT_EXCHANGE, "#");

      // Bounded in-flight work — this is a low-throughput audit trail, not
      // a high-volume pipeline; a small prefetch keeps memory/DB load
      // predictable without needing real backpressure tuning.
      await channel.prefetch(10);

      await channel.consume(AUDIT_QUEUE, (msg) => void handleMessage(channel, msg), { noAck: false });

      connection.on("close", () => {
        console.warn("RabbitMQ connection closed, reconnecting…");
        connecting = false;
        void connectConsumer();
      });
      connection.on("error", (error) => {
        console.warn("RabbitMQ connection error:", error);
      });

      console.log(`audit-service consuming "${AUDIT_QUEUE}" (bound to "${AUDIT_EXCHANGE}")`);
      return;
    } catch (error) {
      console.warn(`RabbitMQ connection failed, retrying in ${RETRY_DELAY_MS}ms:`, error);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

// At-least-once delivery is the explicit contract here — the SAME eventId
// can arrive more than once (a redelivery after this process crashed
// between persisting and acking, a publisher that re-sent after its own
// crash, ...). The message is only ever acked AFTER persistIdempotent()
// has actually completed (created or already-existed both count as
// success) — never before, and never speculatively.
export async function handleMessage(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return;

  let event: AuditEventMessage;
  try {
    event = JSON.parse(msg.content.toString("utf8")) as AuditEventMessage;
  } catch (error) {
    // Malformed payload can never succeed on retry — dead-letter immediately
    // rather than looping on it forever.
    console.error("Discarding unparseable audit event (dead-lettered):", error);
    channel.nack(msg, false, false);
    return;
  }

  for (let attempt = 1; attempt <= MAX_PROCESSING_ATTEMPTS; attempt++) {
    try {
      const { created } = await persistIdempotent(event);
      console.log(`Audit event ${event.eventId} (${event.eventType}) ${created ? "persisted" : "already recorded"}`);
      channel.ack(msg);
      return;
    } catch (error) {
      console.warn(
        `Failed to persist audit event ${event.eventId}, attempt ${attempt}/${MAX_PROCESSING_ATTEMPTS}:`,
        error,
      );
      if (attempt < MAX_PROCESSING_ATTEMPTS) {
        await sleep(PROCESSING_RETRY_DELAY_MS * attempt);
      }
    }
  }

  // Exhausted in-process retries (e.g. the database was down the whole
  // time this message was being processed) — dead-letter rather than
  // requeue-looping against a broker that's fine but a downstream
  // dependency that isn't. The message is preserved in the DLQ, not lost.
  console.error(`Giving up on audit event ${event.eventId} after ${MAX_PROCESSING_ATTEMPTS} attempts — dead-lettering`);
  channel.nack(msg, false, false);
}
