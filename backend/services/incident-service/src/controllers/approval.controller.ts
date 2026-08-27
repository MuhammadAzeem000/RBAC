import { Request, Response } from "express";
import { z } from "zod";
import { decideApprovalSchema, listApprovalsQuerySchema } from "../interfaces/approval";
import * as approvalService from "../services/approval.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { parseBigIntId, parseQuery } from "../utils";

export async function decideApproval(req: Request, res: Response) {
  const approvalId = parseBigIntId(req.params.id);
  if (approvalId === null) {
    res.status(400).json({ error: "Invalid approval id" });
    return;
  }

  const result = decideApprovalSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const approval = await approvalService.decideApproval(req.db, approvalId, result.data.decision, req.auth!.userId);

  await recordTimelineEvent(req.db, req.auth!.tenantId, {
    incidentId: approval.incidentId,
    eventType: result.data.decision === "approved" ? "approval_approved" : "approval_rejected",
    actorUserId: req.auth!.userId,
    summary: approval.stepKey
      ? `Approval for step "${approval.stepKey}" ${result.data.decision}`
      : `Playbook start approval ${result.data.decision}`,
    metadata: { approvalId: approval.id.toString() },
  });

  res.json(approval);
}

export async function listApprovals(req: Request, res: Response) {
  const query = parseQuery(listApprovalsQuerySchema, req, res);
  if (!query) return;

  const approvals = await approvalService.listApprovals(req.db, query.status);
  res.json({ data: approvals });
}
