// Activities run in a normal Node.js context (unlike workflows.ts, which is
// sandboxed) — this is the only place in the Temporal integration allowed
// to touch Prisma, the outbox, or publish domain events. Every function
// here builds its own tenant-scoped client via forTenant(), the exact same
// pattern the pre-Temporal setTimeout-based scheduleSimulatedCompletion()
// used — activities, like that old detached timer, run with no req/req.db
// to inherit.
import { forTenant, PlaybookStep } from "@responderx/shared";
import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { writeOutboxEvent } from "../services/outbox.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";

const TENANT_SCOPED_MODELS = ["PlaybookRun", "TimelineEvent", "OutboxEvent", "StepExecution"] as const;

function scopedDb(tenantId: string) {
  return forTenant(prisma, BigInt(tenantId), TENANT_SCOPED_MODELS);
}

export async function markRunning(runId: string, tenantId: string): Promise<void> {
  const db = scopedDb(tenantId);
  await db.playbookRun.update({
    where: { id: BigInt(runId) },
    data: { state: "running", startedAt: new Date() },
  });
}

// Approving a disruptive action is exactly the kind of decision the MVP
// plan requires be centrally audited — this activity is what preserves
// Phase 1's audit-gap fix (approvals reaching audit-service) now that
// approval is a signal instead of a synchronous HTTP-driven DB update.
export async function recordApproval(runId: string, tenantId: string, approverId: string): Promise<void> {
  const db = scopedDb(tenantId);
  await db.$transaction(async (tx) => {
    const updated = await tx.playbookRun.update({
      where: { id: BigInt(runId) },
      data: { approvedBy: BigInt(approverId), approvedAt: new Date() },
    });

    await writeOutboxEvent(tx, {
      tenantId: BigInt(tenantId),
      eventType: "PLAYBOOK_RUN_APPROVED",
      aggregateType: "PLAYBOOK_RUN",
      aggregateId: updated.id.toString(),
      actorId: approverId,
      action: "APPROVE",
      resourceType: "PLAYBOOK_RUN",
      resourceId: updated.id.toString(),
      metadata: { playbookKey: updated.playbookKey },
    });
  });
}

export async function recordStepStart(
  runId: string,
  tenantId: string,
  incidentId: string,
  step: PlaybookStep,
): Promise<string> {
  const db = scopedDb(tenantId);
  const row = await db.stepExecution.create({
    data: {
      tenantId: BigInt(tenantId),
      playbookRunId: BigInt(runId),
      stepKey: step.key,
      stepName: step.name,
      status: "running",
      input: step.config as Prisma.InputJsonValue,
      startedAt: new Date(),
      attempts: 1,
    },
  });

  await recordTimelineEvent(db, BigInt(tenantId), {
    incidentId: BigInt(incidentId),
    eventType: "playbook_step_started",
    summary: `Step "${step.name}" started`,
    metadata: { runId, stepExecutionId: row.id.toString() },
  });

  return row.id.toString();
}

export interface StepOutcome {
  output?: Record<string, unknown>;
  error?: string;
}

export async function recordStepResult(stepExecutionId: string, tenantId: string, outcome: StepOutcome): Promise<void> {
  const db = scopedDb(tenantId);
  await db.stepExecution.update({
    where: { id: BigInt(stepExecutionId) },
    data: {
      status: outcome.error ? "failed" : "succeeded",
      output: outcome.output ? (outcome.output as Prisma.InputJsonValue) : undefined,
      endedAt: new Date(),
    },
  });
}

// Still simulated — no real connectors exist yet (a later phase). What's
// real now is that this runs as an individually retried, individually
// timed-out, individually observable Temporal Activity instead of being
// baked into one opaque setTimeout for the whole run.
export async function runSimulatedStep(step: PlaybookStep): Promise<Record<string, unknown>> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { message: `${step.name} completed successfully (simulated).` };
}

export async function markSucceeded(runId: string, tenantId: string, incidentId: string, summary: string): Promise<void> {
  const db = scopedDb(tenantId);
  const run = await db.playbookRun.update({
    where: { id: BigInt(runId) },
    data: { state: "succeeded", endedAt: new Date(), outputsSummary: summary },
  });

  await recordTimelineEvent(db, BigInt(tenantId), {
    incidentId: BigInt(incidentId),
    eventType: "playbook_completed",
    summary: `Playbook "${run.playbookKey}" completed: ${run.state}`,
    metadata: { runId, state: run.state },
  });
  void publishEvent(ROUTING_KEYS.PLAYBOOK_COMPLETED, {
    incidentId,
    runId,
    playbookKey: run.playbookKey,
    state: run.state,
  });
}

export async function markFailed(runId: string, tenantId: string, incidentId: string, errorMessage: string): Promise<void> {
  const db = scopedDb(tenantId);
  const run = await db.playbookRun.update({
    where: { id: BigInt(runId) },
    data: { state: "failed", endedAt: new Date(), errorMessage },
  });

  await recordTimelineEvent(db, BigInt(tenantId), {
    incidentId: BigInt(incidentId),
    eventType: "playbook_completed",
    summary: `Playbook "${run.playbookKey}" failed: ${errorMessage}`,
    metadata: { runId, state: run.state },
  });
  void publishEvent(ROUTING_KEYS.PLAYBOOK_COMPLETED, {
    incidentId,
    runId,
    playbookKey: run.playbookKey,
    state: run.state,
  });
}

export async function markCancelled(runId: string, tenantId: string, incidentId: string): Promise<void> {
  const db = scopedDb(tenantId);
  const run = await db.playbookRun.update({
    where: { id: BigInt(runId) },
    data: { state: "cancelled", endedAt: new Date() },
  });

  await recordTimelineEvent(db, BigInt(tenantId), {
    incidentId: BigInt(incidentId),
    eventType: "playbook_cancelled",
    summary: `Playbook "${run.playbookKey}" run cancelled`,
    metadata: { runId },
  });
}
