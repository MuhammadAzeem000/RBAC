import amqplib, { Channel, ConsumeMessage } from "amqplib";
import { z } from "zod";
import { env } from "../config/env";
import {
  ALERT_EXCHANGE,
  ALERT_INGESTION_REPLY_QUEUE,
  INCIDENT_CREATED_FOR_ALERT_ROUTING_KEY,
  INCIDENT_CREATE_FAILED_ROUTING_KEY,
} from "./alertTopology";
import { linkAlertToIncident, markAlertFailed } from "../services/ingestion.service";

const REPLY_DLX = "alert-ingestion-service.incident-replies.dlx";
const REPLY_DLQ = "alert-ingestion-service.incident-replies.dlq";

const RETRY_DELAY_MS = 5000;
const MAX_PROCESSING_ATTEMPTS = 3;
const PROCESSING_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const replyMessageSchema = z.object({
  eventType: z.enum(["INCIDENT_CREATED_FOR_ALERT", "INCIDENT_CREATE_FAILED"]),
  eventId: z.string(),
  tenantId: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

let connecting = false;

// This is the reply half of the incident-creation saga (see
// outboxPublisher.service.ts for the outbound half) — a lost message here
// leaves an Alert stuck at "pending_case" forever even though the Incident
// it's waiting on already exists, which is exactly the kind of silent data
// loss this whole design exists to avoid. Same DLX/DLQ + in-process-retry
// shape as audit-service's consumer, not notification-service's simpler
// drop-on-failure one — this queue's contents matter too much to drop.
export async function connectConsumer(): Promise<void> {
  if (connecting) return;
  connecting = true;

  for (;;) {
    try {
      const connection = await amqplib.connect(env.RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertExchange(ALERT_EXCHANGE, "topic", { durable: true });
      await channel.assertExchange(REPLY_DLX, "fanout", { durable: true });
      await channel.assertQueue(REPLY_DLQ, { durable: true });
      await channel.bindQueue(REPLY_DLQ, REPLY_DLX, "");
      await channel.assertQueue(ALERT_INGESTION_REPLY_QUEUE, {
        durable: true,
        arguments: { "x-dead-letter-exchange": REPLY_DLX },
      });
      await channel.bindQueue(ALERT_INGESTION_REPLY_QUEUE, ALERT_EXCHANGE, INCIDENT_CREATED_FOR_ALERT_ROUTING_KEY);
      await channel.bindQueue(ALERT_INGESTION_REPLY_QUEUE, ALERT_EXCHANGE, INCIDENT_CREATE_FAILED_ROUTING_KEY);

      await channel.prefetch(10);
      await channel.consume(ALERT_INGESTION_REPLY_QUEUE, (msg) => void handleMessage(channel, msg), { noAck: false });

      connection.on("close", () => {
        console.warn("Alert-events consumer: RabbitMQ connection closed, reconnecting…");
        connecting = false;
        void connectConsumer();
      });
      connection.on("error", (error) => {
        console.warn("Alert-events consumer: RabbitMQ connection error:", error);
      });

      console.log(`alert-ingestion-service consuming "${ALERT_INGESTION_REPLY_QUEUE}" (bound to "${ALERT_EXCHANGE}")`);
      return;
    } catch (error) {
      console.warn(`Alert-events consumer connection failed, retrying in ${RETRY_DELAY_MS}ms:`, error);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

export async function handleMessage(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return;

  let event: z.infer<typeof replyMessageSchema>;
  try {
    event = replyMessageSchema.parse(JSON.parse(msg.content.toString("utf8")));
  } catch (error) {
    console.error("Discarding unparseable incident-reply event (dead-lettered):", error);
    channel.nack(msg, false, false);
    return;
  }

  for (let attempt = 1; attempt <= MAX_PROCESSING_ATTEMPTS; attempt++) {
    try {
      const tenantId = BigInt(event.tenantId);
      if (event.eventType === "INCIDENT_CREATED_FOR_ALERT") {
        const alertId = String(event.payload?.alertId);
        const incidentId = String(event.payload?.incidentId);
        await linkAlertToIncident(BigInt(alertId), tenantId, BigInt(incidentId));
      } else {
        const alertId = String(event.payload?.alertId);
        const reason = typeof event.payload?.reason === "string" ? event.payload.reason : "Unknown reason";
        await markAlertFailed(BigInt(alertId), tenantId, reason);
      }
      console.log(`Processed ${event.eventType} (${event.eventId})`);
      channel.ack(msg);
      return;
    } catch (error) {
      console.warn(`Failed to process ${event.eventType} (${event.eventId}), attempt ${attempt}/${MAX_PROCESSING_ATTEMPTS}:`, error);
      if (attempt < MAX_PROCESSING_ATTEMPTS) {
        await sleep(PROCESSING_RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.error(`Giving up on ${event.eventType} (${event.eventId}) after ${MAX_PROCESSING_ATTEMPTS} attempts — dead-lettering`);
  channel.nack(msg, false, false);
}
