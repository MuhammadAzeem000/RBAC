import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { findLatestVersionByKey } from "./playbookCatalog.service";
import { StartPlaybookRunInput } from "../interfaces/playbookRun";
import { cancelPlaybookRunWorkflow, startPlaybookRunWorkflow } from "../temporal/client";

export interface PlaybookRunResponse {
  id: bigint;
  incidentId: bigint;
  playbookVersionId: bigint;
  playbookKey: string;
  playbookVersion: string;
  temporalWorkflowId: string | null;
  state: string;
  requiresApproval: boolean;
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
  initiatedBy: true,
  startedAt: true,
  endedAt: true,
  inputs: true,
  outputsSummary: true,
  errorMessage: true,
  createdAt: true,
} as const;

// The caller (controller) verifies incidentId exists in incident-service
// BEFORE calling this — see services/incidentClient.service.ts's
// verifyIncidentExists, same shape as alert-ingestion-service's attach path.
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
      tenantId,
      incidentId,
      playbookVersionId: resolved.playbookVersionId,
      playbookKey: resolved.playbookKey,
      playbookVersion: resolved.version,
      initiatedBy: actorUserId,
      requiresApproval: resolved.requiresApproval,
      // The Temporal workflow itself drives every subsequent state
      // transition (running/succeeded/failed/cancelled) via activities.ts —
      // this row starts at pending_approval regardless of requiresApproval;
      // the workflow flips it to "running" almost immediately if approval
      // isn't required.
      state: "pending_approval",
      inputs: input.inputs as Prisma.InputJsonValue | undefined,
    },
    select: playbookRunSelect,
  });

  const workflowId = await startPlaybookRunWorkflow({
    runId: run.id,
    tenantId,
    incidentId,
    requestorId: actorUserId,
    playbookName: resolved.playbookName,
    startPolicyKey: resolved.startPolicyKey,
    steps: resolved.steps,
  });

  return db.playbookRun.update({
    where: { id: run.id },
    data: { temporalWorkflowId: workflowId },
    select: playbookRunSelect,
  });
}

export async function cancelPlaybookRun(
  db: Prisma.TransactionClient,
  runId: bigint,
): Promise<PlaybookRunResponse> {
  const existing = await db.playbookRun.findFirst({ where: { id: runId }, select: playbookRunSelect });
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

export function getPlaybookRunById(db: Prisma.TransactionClient, id: bigint): Promise<PlaybookRunResponse | null> {
  return db.playbookRun.findFirst({ where: { id }, select: playbookRunSelect });
}
