// Activities run in a normal Node.js context (unlike workflows.ts, which is
// sandboxed) — this is the only place in the Temporal integration allowed
// to touch Prisma, this service's own outbox, or publish domain events.
// Every function here builds its own tenant-scoped client via forTenant(),
// since activities run with no req/req.db to inherit.
import { ApplicationFailure } from "@temporalio/common";
import { ConnectorActionResponse, forTenant, PlaybookStep } from "@responderx/shared";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { writeOutboxEvent } from "../services/outbox.service";
import { recordIncidentTimelineEvent } from "../services/incidentClient.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";
import { parseDurationToMs } from "./types";

const TENANT_SCOPED_MODELS = ["PlaybookRun", "StepExecution", "Policy", "Approval", "OutboxEvent"] as const;

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

export interface ApprovalGate {
  approvalId: string;
  timeoutDuration: string;
  escalationAfter: string | null;
  escalationChannel: string | null;
}

// Opens one approval gate — the playbook-start gate (stepKey null) or an
// individual step's gate — by looking up the named Policy and creating the
// Approval row that POST /api/v1/approvals/:id/decision will later resolve.
// Requestor is always the run's original initiator (no separate "who
// requested this specific step's approval" concept in this MVP).
//
// Note: this Approval.create() is not idempotent, and the timeline call
// below is now a cross-service HTTP call rather than a local DB write — if
// it fails, Temporal retries this whole Activity (see workflows.ts's
// proxyActivities retry policy), which would re-run the create() too. This
// is a narrow, pre-existing class of risk (recordStepStart has the same
// shape) accepted at the same rigor level as the rest of this dev-stage
// codebase's retry/idempotency posture — not solved here.
export async function createApproval(
  runId: string,
  tenantId: string,
  incidentId: string,
  requestorId: string,
  policyKey: string,
  stepKey: string | null,
): Promise<ApprovalGate> {
  const db = scopedDb(tenantId);
  const policy = await db.policy.findFirst({ where: { key: policyKey } });
  if (!policy) {
    throw ApplicationFailure.nonRetryable(`Unknown policy "${policyKey}"`);
  }

  const approval = await db.approval.create({
    data: {
      tenantId: BigInt(tenantId),
      playbookRunId: BigInt(runId),
      stepKey,
      policyKey,
      requestorUserId: BigInt(requestorId),
      expiresAt: new Date(Date.now() + parseDurationToMs(policy.timeoutDuration)),
    },
  });

  await recordIncidentTimelineEvent(tenantId, incidentId, {
    eventType: "approval_requested",
    summary: stepKey ? `Approval requested for step "${stepKey}"` : "Approval requested to start the playbook",
    metadata: { approvalId: approval.id.toString(), policyKey },
  });

  return {
    approvalId: approval.id.toString(),
    timeoutDuration: policy.timeoutDuration,
    escalationAfter: policy.escalationAfter,
    escalationChannel: policy.escalationChannel,
  };
}

// A human decision — approve or reject. Preserves decisions reaching
// audit-service (this service's own outbox now, not incident-service's) now
// backed by a real, queryable Approval row. This is the SOLE writer of the
// approval_approved/approval_rejected timeline entry — see the incident-service
// side (approval.controller.ts) for the duplicate-write bug this replaces.
export async function recordDecision(
  approvalId: string,
  tenantId: string,
  incidentId: string,
  decision: "approved" | "rejected",
  approverId: string,
): Promise<void> {
  const db = scopedDb(tenantId);
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.approval.update({
      where: { id: BigInt(approvalId) },
      data: { decision, approverUserId: BigInt(approverId), decidedAt: new Date() },
    });

    await writeOutboxEvent(tx, {
      tenantId: BigInt(tenantId),
      eventType: decision === "approved" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      aggregateType: "APPROVAL",
      aggregateId: row.id.toString(),
      actorId: approverId,
      action: decision.toUpperCase(),
      resourceType: "APPROVAL",
      resourceId: row.id.toString(),
      metadata: { policyKey: row.policyKey, stepKey: row.stepKey },
    });

    return row;
  });

  await recordIncidentTimelineEvent(tenantId, incidentId, {
    eventType: decision === "approved" ? "approval_approved" : "approval_rejected",
    actorUserId: approverId,
    summary: updated.stepKey ? `Approval for step "${updated.stepKey}" ${decision}` : `Playbook start approval ${decision}`,
    metadata: { approvalId },
  });
}

export async function expireApproval(approvalId: string, tenantId: string, incidentId: string): Promise<void> {
  const db = scopedDb(tenantId);
  await db.approval.update({ where: { id: BigInt(approvalId) }, data: { decision: "expired", decidedAt: new Date() } });

  await recordIncidentTimelineEvent(tenantId, incidentId, {
    eventType: "approval_expired",
    summary: "Approval expired without a decision",
    metadata: { approvalId },
  });
}

// Best-effort only — a failed or unconfigured Slack connector must never
// fail the approval wait itself, so every error here is caught and logged,
// never re-thrown.
export async function escalateApproval(
  approvalId: string,
  tenantId: string,
  policyKey: string,
  stepKey: string | null,
  channel: string,
): Promise<void> {
  const db = scopedDb(tenantId);
  const text = stepKey
    ? `Approval for step "${stepKey}" (policy "${policyKey}") is overdue and needs a decision.`
    : `Approval to start a playbook (policy "${policyKey}") is overdue and needs a decision.`;

  try {
    await callConnectorAction("slack", "postMessage", tenantId, { channel, text });
  } catch (error) {
    console.error(`Escalation notification failed for approval ${approvalId}:`, error);
  }

  await db.approval.update({ where: { id: BigInt(approvalId) }, data: { escalatedAt: new Date() } });
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

  await recordIncidentTimelineEvent(tenantId, incidentId, {
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
      error: outcome.error,
      endedAt: new Date(),
    },
  });
}

// The one place this service calls integration-service's connector
// runtime — used both by runStep (a playbook step bound to a connector)
// and escalateApproval (a policy's Slack escalation channel), so both get
// identical error classification into retryable-vs-not.
async function callConnectorAction(
  connector: string,
  action: string,
  tenantId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${env.INTEGRATION_SERVICE_URL}/api/connectors/${connector}/actions/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Token": env.INTEGRATION_SERVICE_TOKEN },
      body: JSON.stringify({ tenantId, params }),
    });
  } catch (error) {
    // Network-level failure (integration-service unreachable, timeout) —
    // transient by nature, let Temporal's own retry policy on this
    // Activity (see workflows.ts's proxyActivities config) handle it.
    throw new Error(`Connector runtime unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    // A request-level failure from integration-service itself (unknown
    // connector/action, no credentials configured, bad service token) —
    // these are deterministic misconfigurations, not something a retry
    // fixes, so Temporal shouldn't burn its retry budget on them.
    const body = await response.text();
    throw ApplicationFailure.nonRetryable(`Connector runtime error (HTTP ${response.status}): ${body}`);
  }

  const body = (await response.json()) as ConnectorActionResponse;
  if (!body.ok) {
    const message = body.error?.message ?? "Connector action failed";
    if (body.error?.retryable === false) {
      throw ApplicationFailure.nonRetryable(message);
    }
    throw new Error(message);
  }

  return body.result ?? {};
}

// A step with no connector/action bound to it still runs simulated. A step
// WITH connector/action calls the real connector runtime (integration-service)
// instead: still runs as this same individually retried, individually
// timed-out, individually observable Temporal Activity, just doing real
// work instead of a setTimeout.
export async function runStep(step: PlaybookStep, tenantId: string): Promise<Record<string, unknown>> {
  if (!step.connector || !step.action) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { message: `${step.name} completed successfully (simulated).` };
  }
  return callConnectorAction(step.connector, step.action, tenantId, step.config);
}

export async function markSucceeded(runId: string, tenantId: string, incidentId: string, summary: string): Promise<void> {
  const db = scopedDb(tenantId);
  const run = await db.playbookRun.update({
    where: { id: BigInt(runId) },
    data: { state: "succeeded", endedAt: new Date(), outputsSummary: summary },
  });

  await recordIncidentTimelineEvent(tenantId, incidentId, {
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

  await recordIncidentTimelineEvent(tenantId, incidentId, {
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

  // A pending approval for a run that just got cancelled is no longer
  // actionable — reuse "expired" rather than adding a fifth decision value
  // for what's really the same "this gate is now moot" outcome.
  await db.approval.updateMany({
    where: { playbookRunId: BigInt(runId), decision: "pending" },
    data: { decision: "expired", decidedAt: new Date() },
  });

  await recordIncidentTimelineEvent(tenantId, incidentId, {
    eventType: "playbook_cancelled",
    summary: `Playbook "${run.playbookKey}" run cancelled`,
    metadata: { runId },
  });
}
