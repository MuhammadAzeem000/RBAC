import amqplib, { Channel } from "amqplib";
import { env } from "../config/env";
import { INCIDENT_EVENTS_EXCHANGE } from "./topology";

const RETRY_DELAY_MS = 5000;

let channel: Channel | null = null;
let connecting = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Connects in the background and keeps retrying on failure/drop — never
// blocks server startup and never throws. If RabbitMQ is unreachable,
// publishEvent() below just logs and no-ops instead of failing the request
// (or Activity) that triggered it. Mirrors incident-service's own
// eventBus.service.ts exactly (this exchange is shared, see topology.ts).
export async function connectEventBus(): Promise<void> {
  if (connecting) return;
  connecting = true;

  for (;;) {
    try {
      const connection = await amqplib.connect(env.RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertExchange(INCIDENT_EVENTS_EXCHANGE, "topic", { durable: true });

      connection.on("close", () => {
        console.warn("RabbitMQ connection closed, reconnecting…");
        channel = null;
        connecting = false;
        void connectEventBus();
      });
      connection.on("error", (error) => {
        console.warn("RabbitMQ connection error:", error);
      });

      console.log("Connected to RabbitMQ event bus");
      return;
    } catch (error) {
      console.warn(`RabbitMQ connection failed, retrying in ${RETRY_DELAY_MS}ms:`, error);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

export async function publishEvent(routingKey: string, payload: Record<string, unknown>): Promise<void> {
  if (!channel) {
    console.warn(`Event bus not connected — dropping event "${routingKey}"`);
    return;
  }

  try {
    channel.publish(INCIDENT_EVENTS_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: "application/json",
    });
  } catch (error) {
    console.error(`Failed to publish event "${routingKey}":`, error);
  }
}
