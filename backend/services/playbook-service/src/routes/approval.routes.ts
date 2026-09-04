import { Router } from "express";
import * as approvalController from "../controllers/approval.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireApprovalPermission } from "../middlewares/requireApprovalPermission";
import { asyncHandler } from "../utils";

export const approvalRouter = Router();

const canView = requireApprovalPermission(ACTION_NAMES.VIEW);
const canUpdate = requireApprovalPermission(ACTION_NAMES.UPDATE);

/**
 * @openapi
 * /approvals:
 *   get:
 *     summary: List approval gates
 *     tags: [Approvals]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, expired] }
 *     responses:
 *       200:
 *         description: Every approval gate matching the filter (playbook-start and per-step gates alike).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       playbookRunId: { type: string }
 *                       incidentId: { type: string }
 *                       stepKey: { type: string, nullable: true, description: "null means the playbook-start gate." }
 *                       policyKey: { type: string }
 *                       requestorUserId: { type: string }
 *                       approverUserId: { type: string, nullable: true }
 *                       decision: { type: string, enum: [pending, approved, rejected, expired] }
 *                       requestedAt: { type: string, format: date-time }
 *                       decidedAt: { type: string, format: date-time, nullable: true }
 *                       expiresAt: { type: string, format: date-time, nullable: true }
 *                       escalatedAt: { type: string, format: date-time, nullable: true }
 */
approvalRouter.get("/", canView, asyncHandler(approvalController.listApprovals));

/**
 * @openapi
 * /approvals/{id}/decision:
 *   post:
 *     summary: Approve or reject a pending approval gate
 *     description: >
 *       Signals the Temporal workflow running the playbook rather than updating the row directly — the response
 *       reflects the update in the common case via a short wait-then-refetch, but the authoritative write happens
 *       once the workflow actually processes the signal.
 *     tags: [Approvals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [approved, rejected] }
 *     responses:
 *       200:
 *         description: The approval row (reflecting the decision once the workflow has processed the signal).
 *       400:
 *         description: Invalid approval id, validation error, or the approval is no longer pending.
 *       409:
 *         description: This approval predates durable orchestration and can no longer be decided.
 */
approvalRouter.post("/:id/decision", canUpdate, asyncHandler(approvalController.decideApproval));
