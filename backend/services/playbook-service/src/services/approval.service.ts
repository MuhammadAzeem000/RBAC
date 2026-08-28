import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { signalDecision } from "../temporal/client";

export interface ApprovalResponse {
  id: bigint;
  playbookRunId: bigint;
  incidentId: bigint;
  stepKey: string | null;
  policyKey: string;
  requestorUserId: bigint;
  approverUserId: bigint | null;
  decision: string;
  requestedAt: Date;
  decidedAt: Date | null;
  expiresAt: Date | null;
  escalatedAt: Date | null;
}

const approvalSelect = {
  id: true,
  playbookRunId: true,
  stepKey: true,
  policyKey: true,
  requestorUserId: true,
  approverUserId: true,
  decision: true,
  requestedAt: true,
  decidedAt: true,
  expiresAt: true,
  escalatedAt: true,
  playbookRun: { select: { incidentId: true } },
} as const;

function toResponse(row: {
  id: bigint;
  playbookRunId: bigint;
  stepKey: string | null;
  policyKey: string;
  requestorUserId: bigint;
  approverUserId: bigint | null;
  decision: string;
  requestedAt: Date;
  decidedAt: Date | null;
  expiresAt: Date | null;
  escalatedAt: Date | null;
  playbookRun: { incidentId: bigint };
}): ApprovalResponse {
  return {
    id: row.id,
    playbookRunId: row.playbookRunId,
    incidentId: row.playbookRun.incidentId,
    stepKey: row.stepKey,
    policyKey: row.policyKey,
    requestorUserId: row.requestorUserId,
    approverUserId: row.approverUserId,
    decision: row.decision,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    expiresAt: row.expiresAt,
    escalatedAt: row.escalatedAt,
  };
}

// Signals the workflow rather than updating the row directly — the actual
// state change (and the audit outbox event) happens in an Activity
// (recordDecision, temporal/activities.ts) once the workflow processes the
// signal, which is asynchronous. This does one short re-fetch so the HTTP
// response still reflects the update in the common case, same trade-off as
// playbookRun.service.ts's cancelPlaybookRun.
export async function decideApproval(
  db: Prisma.TransactionClient,
  approvalId: bigint,
  decision: "approved" | "rejected",
  approverUserId: bigint,
): Promise<ApprovalResponse> {
  const existing = await db.approval.findFirst({ where: { id: approvalId }, select: approvalSelect });
  if (!existing) {
    throw new HttpError(404, "Approval not found");
  }
  if (existing.decision !== "pending") {
    throw new HttpError(400, `Approval is already "${existing.decision}"`);
  }

  const run = await db.playbookRun.findFirst({
    where: { id: existing.playbookRunId },
    select: { temporalWorkflowId: true },
  });
  if (!run?.temporalWorkflowId) {
    throw new HttpError(409, "This approval predates durable orchestration and can no longer be decided");
  }

  await signalDecision(run.temporalWorkflowId, decision, approverUserId);

  await new Promise((resolve) => setTimeout(resolve, 250));
  const refreshed = await db.approval.findFirst({ where: { id: approvalId }, select: approvalSelect });
  return toResponse(refreshed ?? existing);
}

export async function listApprovals(
  db: Prisma.TransactionClient,
  status?: "pending" | "approved" | "rejected" | "expired",
): Promise<ApprovalResponse[]> {
  const rows = await db.approval.findMany({
    where: status ? { decision: status } : undefined,
    select: approvalSelect,
    orderBy: { requestedAt: "desc" },
  });
  return rows.map(toResponse);
}
