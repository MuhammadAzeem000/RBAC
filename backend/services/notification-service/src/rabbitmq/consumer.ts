import { z } from "zod";
import { prisma } from "../config/prisma";
import { connectWithRetry } from "./connection";
import { EVENTS_EXCHANGE, QUEUE_NAME, USER_CREATED_ROUTING_KEY } from "./topology";
import { sendEmail } from "../email/mailer";
import { userWelcomeEmail } from "../email/templates/userWelcome";
import { writeOutboxEvent } from "../services/outbox.service";

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
        // improvement here for retry/inspection instead of dropping. Note
        // this only affects the ORIGINAL rbac.events message — a send
        // failure is still durably recorded below (Notification row +
        // outbox event) before this catch ever runs.
        channel.nack(msg, false, false);
      });
  });
}

export async function handleMessage(content: Buffer): Promise<void> {
  const parsed = userCreatedEventSchema.parse(JSON.parse(content.toString("utf-8")));
  const { subject, html, text } = userWelcomeEmail({ name: parsed.name, email: parsed.email });

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;
  try {
    await sendEmail({ to: parsed.email, subject, html, text });
    console.log(`Sent welcome email to ${parsed.email}`);
  } catch (error) {
    status = "failed";
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to send welcome email to ${parsed.email}:`, error);
  }

  // The Notification row (this service's first-ever persisted business
  // state) and its audit outbox event are written atomically — whether the
  // send succeeded or failed, "an attempt happened with this outcome" is
  // the fact being recorded, and it must never exist as one without the other.
  await prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({
      data: {
        recipientEmail: parsed.email,
        templateKey: "user_welcome",
        status,
        errorMessage,
        relatedUserId: parsed.userId,
      },
    });

    await writeOutboxEvent(tx, {
      eventType: status === "sent" ? "NOTIFICATION_SENT" : "NOTIFICATION_FAILED",
      aggregateType: "NOTIFICATION",
      aggregateId: notification.id.toString(),
      actorId: null,
      actorType: "SYSTEM",
      action: status === "sent" ? "SEND" : "FAIL",
      resourceType: "NOTIFICATION",
      resourceId: notification.id.toString(),
      metadata: { recipientEmail: parsed.email, templateKey: "user_welcome" },
    });
  });

  if (status === "failed") {
    // Re-throw so the existing nack/drop handling above still applies to
    // the original event — recording the failure durably doesn't mean it
    // should be silently treated as handled.
    throw new Error(`Failed to send welcome email: ${errorMessage}`);
  }
}
