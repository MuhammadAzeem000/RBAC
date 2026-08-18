import amqplib, { Channel, ChannelModel } from "amqplib";
import { env } from "../config/env";

const RETRY_DELAY_MS = 3000;
const MAX_ATTEMPTS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// RabbitMQ may still be finishing startup even after its container health
// check passes, so connecting is retried with a fixed backoff instead of
// failing the whole service on the first attempt.
export async function connectWithRetry(): Promise<{ connection: ChannelModel; channel: Channel }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const connection = await amqplib.connect(env.RABBITMQ_URL);
      const channel = await connection.createChannel();
      console.log(`Connected to RabbitMQ (attempt ${attempt})`);
      return { connection, channel };
    } catch (error) {
      lastError = error;
      console.warn(`RabbitMQ connection attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${RETRY_DELAY_MS}ms`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(`Could not connect to RabbitMQ after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`);
}
