import { z } from "zod";
import { connectWithRetry } from "./connection";
import { EVENTS_EXCHANGE, QUEUE_NAME, USER_CREATED_ROUTING_KEY } from "./topology";
import { sendEmail } from "../email/mailer";
import { userWelcomeEmail } from "../email/templates/userWelcome";

const userCreatedEventSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
});

export async function startConsumer(): Promise<void> {
  const { channel } = await connectWithRetry();

  await channel.assertExchange(EVENTS_EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EVENTS_EXCHANGE, USER_CREATED_ROUTING_KEY);

  // One message at a time — simplest correct behavior for low-volume email
  // sending, and avoids overwhelming the SMTP transport under a burst.
  channel.prefetch(1);

  console.log(`Listening on "${QUEUE_NAME}" (routing key "${USER_CREATED_ROUTING_KEY}")`);

  channel.consume(QUEUE_NAME, (msg) => {
    if (!msg) return;

    void handleMessage(msg.content)
      .then(() => channel.ack(msg))
      .catch((error) => {
        console.error("Failed to process user.created event, dropping message:", error);
        // No requeue: a malformed payload or a permanently failing send would
        // otherwise loop forever. A dead-letter exchange would be the next
        // improvement here for retry/inspection instead of dropping.
        channel.nack(msg, false, false);
      });
  });
}

async function handleMessage(content: Buffer): Promise<void> {
  const parsed = userCreatedEventSchema.parse(JSON.parse(content.toString("utf-8")));
  const { subject, html, text } = userWelcomeEmail({ name: parsed.name, email: parsed.email });
  await sendEmail({ to: parsed.email, subject, html, text });
  console.log(`Sent welcome email to ${parsed.email}`);
}
