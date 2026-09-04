import { Router } from "express";
import * as playbookRunController from "../controllers/playbookRun.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const playbookRunRouter = Router();

const canView = requireIncidentPermission(ACTION_NAMES.VIEW);
const canUpdate = requireIncidentPermission(ACTION_NAMES.UPDATE);

/**
 * @openapi
 * /playbook-runs:
 *   post:
 *     summary: Start a playbook run against an incident
 *     description: Starts a durable Temporal workflow execution that survives a worker restart. See GET /playbook-runs/{id} to poll its state.
 *     tags: [Playbook Runs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [incidentId, playbookKey]
 *             properties:
 *               incidentId: { type: string }
 *               playbookKey: { type: string }
 *               inputs: { type: object, additionalProperties: true }
 *     responses:
 *       201:
 *         description: The created run, at state "pending_approval" (flips to "running" almost immediately if no approval gate applies).
 *       400:
 *         description: Unknown playbook key.
 *       404:
 *         description: Incident not found.
 *   get:
 *     summary: List playbook runs for an incident
 *     tags: [Playbook Runs]
 *     parameters:
 *       - in: query
 *         name: incidentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Every run started against this incident, most recent first.
 *       400:
 *         description: Query param 'incidentId' is required and must be numeric.
 */
playbookRunRouter.post("/", canUpdate, asyncHandler(playbookRunController.startPlaybookRun));
playbookRunRouter.get("/", canView, asyncHandler(playbookRunController.listPlaybookRuns));

/**
 * @openapi
 * /playbook-runs/{id}:
 *   get:
 *     summary: Get a playbook run by id
 *     tags: [Playbook Runs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The run, including its current state (pending_approval/running/succeeded/failed/cancelled).
 *       400:
 *         description: Invalid playbook run id.
 *       404:
 *         description: Playbook run not found.
 */
playbookRunRouter.get("/:id", canView, asyncHandler(playbookRunController.getPlaybookRun));

/**
 * @openapi
 * /playbook-runs/{id}/cancel:
 *   post:
 *     summary: Cancel an in-flight playbook run
 *     description: Cancels the underlying Temporal workflow execution and expires any of its still-pending approval gates.
 *     tags: [Playbook Runs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The run (reflecting the cancellation once the workflow has processed it, via a short wait-then-refetch).
 *       400:
 *         description: The run already reached a terminal state (succeeded/failed/cancelled).
 *       404:
 *         description: Playbook run not found.
 *       409:
 *         description: This run predates durable orchestration and can no longer be cancelled.
 */
playbookRunRouter.post("/:id/cancel", canUpdate, asyncHandler(playbookRunController.cancelPlaybookRun));
