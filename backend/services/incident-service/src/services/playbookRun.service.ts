import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { findLatestVersionByKey } from "./playbookCatalog.service";
import { StartPlaybookRunInput } from "../interfaces/playbookRun";
import {
  cancelPlaybookRunWorkflow,
  signalApproval,
  startPlaybookRunWorkflow,
} from "../temporal/client";

export interface PlaybookRunResponse {
  id: bigint;
  incidentId: bigint;
  playbookVersionId: bigint;
  playbookKey: string;
  playbookVersion: string;
  temporalWorkflowId: string | null;
  state: string;
  requiresApproval: boolean;
  approvedBy: bigint | null;
  approvedAt: Date | null;
  initiatedBy: bigint;
  startedAt: Date | null;
  endedAt: Date | null;
  inputs: unknown;
  outputsSummary: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

const playbookRunSelect = {
  id: true,
  incidentId: true,
  playbookVersionId: true,
  playbookKey: true,
  playbookVersion: true,
  temporalWorkflowId: true,
  state: true,
  requiresApproval: true,
  approvedBy: true,
  approvedAt: true,
  initiatedBy: true,
  startedAt: true,
  endedAt: true,
  inputs: true,
  outputsSummary: true,
  errorMessage: true,
  createdAt: true,
} as const;

export async function startPlaybookRun(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  incidentId: bigint,
  input: StartPlaybookRunInput,
  actorUserId: bigint,
): Promise<PlaybookRunResponse> {
  const resolved = await findLatestVersionByKey(db, input.playbookKey);
  if (!resolved) {
    throw new HttpError(400, `Unknown playbook "${input.playbookKey}"`);
  }

  const run = await db.playbookRun.create({
    data: {
      // See incident.service.ts::createIncident for why this is passed
      // explicitly even though the tenant-scoping extension overwrites it.
      tenantId,
      incidentId,
      playbookVersionId: resolved.playbookVersionId,
      playbookKey: resolved.playbookKey,
      playbookVersion: resolved.version,
      initiatedBy: actorUserId,
      requiresApproval: resolved.requiresApproval,
      // The Temporal workflow itself now drives every subsequent state
      // transition (running/succeeded/failed/cancelled) via activities.ts —
      // this row starts at pending_approval regardless of requiresApproval;
      // the workflow flips it to "running" almost immediately if approval
      // isn't required, same as the old synchronous behavior looked like.
      state: "pending_approval",
      inputs: input.inputs as Prisma.InputJsonValue | undefined,
    },
    select: playbookRunSelect,
  });

  const workflowId = await startPlaybookRunWorkflow({
    runId: run.id,
    tenantId,
    incidentId,
    playbookName: resolved.playbookName,
    requiresApproval: resolved.requiresApproval,
    steps: resolved.steps,
  });

  return db.playbookRun.update({
    where: { id: run.id },
    data: { temporalWorkflowId: workflowId },
    select: playbookRunSelect,
  });
}

// Signals the workflow rather than updating state directly — the actual
// state change (and the audit outbox event) happens in an Activity
// (recordApproval, temporal/activities.ts) once the workflow processes the
// signal, which is asynchronous. This does one short re-fetch so the HTTP
// response still reflects the update in the common case, without claiming
// the synchronous guarantee the old (fake) implementation had.
export async function approvePlaybookRun(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  incidentId: bigint,
  runId: bigint,
  actorUserId: bigint,
): Promise<PlaybookRunResponse> {
  const existing = await db.playbookRun.findFirst({ where: { id: runId, incidentId } });
  if (!existing) {
    throw new HttpError(404, "Playbook run not found");
  }
  if (existing.state !== "pending_approval") {
    throw new HttpError(400, `Run is "${existing.state}", not awaiting approval`);
  }
  if (!existing.temporalWorkflowId) {
    throw new HttpError(409, "This run predates durable orchestration and can no longer be approved");
  }

  await signalApproval(existing.temporalWorkflowId, actorUserId);

  await new Promise((resolve) => setTimeout(resolve, 250));
  const refreshed = await db.playbookRun.findFirst({ where: { id: runId }, select: playbookRunSelect });
  return refreshed ?? { ...existing, temporalWorkflowId: existing.temporalWorkflowId };
}

export async function cancelPlaybookRun(
  db: Prisma.TransactionClient,
  incidentId: bigint,
  runId: bigint,
): Promise<PlaybookRunResponse> {
  const existing = await db.playbookRun.findFirst({ where: { id: runId, incidentId }, select: playbookRunSelect });
  if (!existing) {
    throw new HttpError(404, "Playbook run not found");
  }
  if (["succeeded", "failed", "cancelled"].includes(existing.state)) {
    throw new HttpError(400, `Run is already "${existing.state}"`);
  }
  if (!existing.temporalWorkflowId) {
    throw new HttpError(409, "This run predates durable orchestration and can no longer be cancelled");
  }

  await cancelPlaybookRunWorkflow(existing.temporalWorkflowId);

  await new Promise((resolve) => setTimeout(resolve, 250));
  const refreshed = await db.playbookRun.findFirst({ where: { id: runId }, select: playbookRunSelect });
  return refreshed ?? existing;
}

export function listPlaybookRuns(db: Prisma.TransactionClient, incidentId: bigint): Promise<PlaybookRunResponse[]> {
  return db.playbookRun.findMany({
    where: { incidentId },
    select: playbookRunSelect,
    orderBy: { createdAt: "desc" },
  });
}

