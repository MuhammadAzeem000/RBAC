import { Request, Response } from "express";
import { z } from "zod";
import { decideApprovalSchema, listApprovalsQuerySchema } from "../interfaces/approval";
import * as approvalService from "../services/approval.service";
import { parseQuery } from "../utils";
import { HttpError } from "../middlewares/errorHandler";
import { parseBigIntId } from "../utils";

export async function decideApproval(req: Request, res: Response) {
  const approvalId = parseBigIntId(req.params.id);
  if (approvalId === null) {
    throw new HttpError(400, "Invalid approval id");
  }

  const result = decideApprovalSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  // Signals the Temporal workflow rather than updating the row directly —
  // approval.service.ts does a short wait-then-refetch so the HTTP response
  // still reflects the update in the common case. The timeline entry for
  // this decision is written exactly once, by temporal/activities.ts's
  // recordDecision (the authoritative write, firing after the workflow
  // actually processes the signal) — this controller deliberately does NOT
  // also write one; the old incident-service code did, producing two
  // timeline rows per decision (see the Phase 5.2 plan's decision 6).
  const approval = await approvalService.decideApproval(req.db, approvalId, result.data.decision, req.auth!.userId);

  res.json(approval);
}

export async function listApprovals(req: Request, res: Response) {
  const query = parseQuery(listApprovalsQuerySchema, req, res);
  if (!query) return;

  const approvals = await approvalService.listApprovals(req.db, query.status);
  res.json({ data: approvals });
}
