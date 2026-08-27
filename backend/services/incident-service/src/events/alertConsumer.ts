import amqplib, { Channel, ConsumeMessage } from "amqplib";
import { z } from "zod";
import { forTenant } from "@responderx/shared";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import {
  ALERT_EXCHANGE,
  ALERT_INGESTED_ROUTING_KEY,
  INCIDENT_CREATED_FOR_ALERT_ROUTING_KEY,
  INCIDENT_CREATE_FAILED_ROUTING_KEY,
  INCIDENT_SERVICE_ALERT_QUEUE,
} from "./alertTopology";
import { createIncidentInTx } from "../services/incident.service";
import { writeOutboxEvent } from "../services/outbox.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { startPlaybookRun } from "../services/playbookRun.service";

const ALERT_DLX = "incident-service.alert-events.dlx";
const ALERT_DLQ = "incident-service.alert-events.dlq";

const RETRY_DELAY_MS = 5000;
const MAX_PROCESSING_ATTEMPTS = 3;
const PROCESSING_RETRY_DELAY_MS = 500;

// Same tenant-scoped model list tenantContext.ts grants an authenticated
// request — this consumer has no request to inherit one from, so it builds
// its own from the event's own tenantId, mirroring src/temporal/activities.ts.
const TENANT_SCOPED_MODELS = [
  "Incident",
  "Task",
  "Evidence",
  "Comment",
  "PlaybookRun",
  "TimelineEvent",
  "OutboxEvent",
  "Playbook",
  "PlaybookVersion",
  "StepExecution",
  "Policy",
  "Approval",
] as const;

function scopedDb(tenantId: bigint) {
  return forTenant(prisma, tenantId, TENANT_SCOPED_MODELS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const alertIngestedSchema = z.object({
  eventType: z.literal("ALERT_INGESTED"),
  eventId: z.string(),
  tenantId: z.string(),
  payload: z.object({
    alertId: z.string(),
    requestorId: z.string(),
    source: z.string(),
    externalId: z.string(),
    // Matches @responderx/shared's alertSeveritySchema — the value this
    // service receives was already validated against that enum when
    // alert-ingestion-service accepted the original ingest request.
    severity: z.enum(["low", "medium", "high", "critical"]),
    timestamp: z.string(),
    triggerPlaybookKey: z.string().optional(),
  }),
});

let connecting = false;

// The inbound half of the incident-creation saga — see
// outboxPublisher.service.ts's dual-publish for the reply half, and
// alert-ingestion-service's ingestion.service.ts for the outbound half this
// consumes. Same DLX/DLQ + in-process-retry shape as that service's own
// events/consumer.ts — losing a message here means an alert silently never
// becomes a case.
export async function connectAlertConsumer(): Promise<void> {
  if (connecting) return;
  connecting = true;

  for (;;) {
    try {
      const connection = await amqplib.connect(env.RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertExchange(ALERT_EXCHANGE, "topic", { durable: true });
      await channel.assertExchange(ALERT_DLX, "fanout", { durable: true });
      await channel.assertQueue(ALERT_DLQ, { durable: true });
      await channel.bindQueue(ALERT_DLQ, ALERT_DLX, "");
      await channel.assertQueue(INCIDENT_SERVICE_ALERT_QUEUE, {
        durable: true,
        arguments: { "x-dead-letter-exchange": ALERT_DLX },
      });
      await channel.bindQueue(INCIDENT_SERVICE_ALERT_QUEUE, ALERT_EXCHANGE, ALERT_INGESTED_ROUTING_KEY);

      await channel.prefetch(10);
      await channel.consume(INCIDENT_SERVICE_ALERT_QUEUE, (msg) => void handleMessage(channel, msg), { noAck: false });

      connection.on("close", () => {
        console.warn("Alert consumer: RabbitMQ connection closed, reconnecting…");
        connecting = false;
        void connectAlertConsumer();
      });
      connection.on("error", (error) => {
        console.warn("Alert consumer: RabbitMQ connection error:", error);
      });

      console.log(`incident-service consuming "${INCIDENT_SERVICE_ALERT_QUEUE}" (bound to "${ALERT_EXCHANGE}")`);
      return;
    } catch (error) {
      console.warn(`Alert consumer connection failed, retrying in ${RETRY_DELAY_MS}ms:`, error);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

function synthesizeTitle(source: string, externalId: string): string {
  return `${source} alert ${externalId}`;
}

async function replyFailed(tenantId: bigint, alertId: string, reason: string): Promise<void> {
  const db = scopedDb(tenantId);
  await db.$transaction((tx) =>
    writeOutboxEvent(tx, {
      tenantId,
      eventType: "INCIDENT_CREATE_FAILED",
      aggregateType: "ALERT",
      aggregateId: alertId,
      actorId: null,
      actorType: "SYSTEM",
      action: "CREATE_FAILED",
      resourceType: "ALERT",
      resourceId: alertId,
      payload: { alertId, reason },
    }),
  );
}

// Idempotent under RabbitMQ's at-least-once redelivery — the same
// (tenantId, source, externalId) is checked before creating a new Incident,
// exactly mirroring how alert-ingestion-service's own dedup check works on
// its side of the saga. A hit here still (re)sends the reply, in case the
// FIRST reply was what got lost, not the original request.
async function handleAlertIngested(event: z.infer<typeof alertIngestedSchema>): Promise<void> {
  const tenantId = BigInt(event.tenantId);
  const { alertId, requestorId, source, externalId, severity, timestamp, triggerPlaybookKey } = event.payload;
  const db = scopedDb(tenantId);
  const actorUserId = BigInt(requestorId);

  const existing = await db.incident.findFirst({ where: { source, externalId, deletedAt: null }, select: { id: true } });

  let incidentId: bigint;
  let freshlyCreated: boolean;

  if (existing) {
    incidentId = existing.id;
    freshlyCreated = false;
  } else {
    const incident = await db.$transaction(async (tx) => {
      const created = await createIncidentInTx(
        tx,
        tenantId,
        { title: synthesizeTitle(source, externalId), severity, source, externalId, detectedAt: new Date(timestamp) },
        actorUserId,
      );
      await writeOutboxEvent(tx, {
        tenantId,
        eventType: "INCIDENT_CREATED_FOR_ALERT",
        aggregateType: "ALERT",
        aggregateId: alertId,
        actorId: actorUserId.toString(),
        action: "CREATE",
        resourceType: "ALERT",
        resourceId: alertId,
        payload: { alertId, incidentId: created.id.toString() },
      });
      return created;
    });
    incidentId = incident.id;
    freshlyCreated = true;
  }

  if (!freshlyCreated) {
    await db.$transaction((tx) =>
      writeOutboxEvent(tx, {
        tenantId,
        eventType: "INCIDENT_CREATED_FOR_ALERT",
        aggregateType: "ALERT",
        aggregateId: alertId,
        actorId: actorUserId.toString(),
        action: "CREATE",
        resourceType: "ALERT",
        resourceId: alertId,
        payload: { alertId, incidentId: incidentId.toString() },
      }),
    );
    return;
  }

  await recordTimelineEvent(db, tenantId, {
    incidentId,
    eventType: "incident_created_from_alert",
    actorUserId,
    summary: `Incident created from ingested ${source} alert "${externalId}"`,
    metadata: { alertId },
  });

  // A bad/unknown playbookKey must not undo the successful incident
  // creation this reply is about to confirm — logged only, same as the old
  // (Phase 5) controller's handling of this same field.
  if (triggerPlaybookKey) {
    try {
      const run = await startPlaybookRun(db, tenantId, incidentId, { playbookKey: triggerPlaybookKey }, actorUserId);
      await recordTimelineEvent(db, tenantId, {
        incidentId,
        eventType: "playbook_started",
        actorUserId,
        summary:
          run.state === "pending_approval"
            ? `Playbook "${run.playbookKey}" started, awaiting approval`
            : `Playbook "${run.playbookKey}" started`,
        metadata: { runId: run.id.toString(), state: run.state },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`triggerPlaybookKey "${triggerPlaybookKey}" failed for incident ${incidentId}:`, message);
      await recordTimelineEvent(db, tenantId, {
        incidentId,
        eventType: "playbook_start_failed",
        actorUserId,
        summary: `Failed to start playbook "${triggerPlaybookKey}": ${message}`,
      });
    }
  }
}

export async function handleMessage(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return;

  let event: z.infer<typeof alertIngestedSchema>;
  try {
    event = alertIngestedSchema.parse(JSON.parse(msg.content.toString("utf8")));
  } catch (error) {
    console.error("Discarding unparseable alert-ingested event (dead-lettered):", error);
    channel.nack(msg, false, false);
    return;
  }

  for (let attempt = 1; attempt <= MAX_PROCESSING_ATTEMPTS; attempt++) {
    try {
      await handleAlertIngested(event);
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

  console.error(`Giving up on ${event.eventType} (${event.eventId}) after ${MAX_PROCESSING_ATTEMPTS} attempts — replying failed and dead-lettering`);
  try {
    await replyFailed(BigInt(event.tenantId), event.payload.alertId, `incident-service failed to process after ${MAX_PROCESSING_ATTEMPTS} attempts`);
  } catch (error) {
    console.error("Failed to send INCIDENT_CREATE_FAILED reply:", error);
  }
  channel.nack(msg, false, false);
}
