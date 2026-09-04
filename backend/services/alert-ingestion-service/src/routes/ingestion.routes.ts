import { Router } from "express";
import * as ingestionController from "../controllers/ingestion.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const ingestionRouter = Router();

// Same Incidents:Create/View permissions incident-service already checks for
// its own routes — no new RBAC module for this split (see the plan's
// "Gateway + RBAC" step).

/**
 * @openapi
 * /alerts:
 *   post:
 *     summary: Ingest an alert
 *     description: >
 *       Two modes, matched by whether `incidentId` is present in the body: given -> synchronous attach to an
 *       existing incident; omitted -> async ingest-and-create-a-case saga (poll GET /alerts/{id} to see it move
 *       from "pending_case" to "linked").
 *     tags: [Alerts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [source, externalId, severity, timestamp, entities]
 *             properties:
 *               source: { type: string, example: splunk }
 *               externalId: { type: string }
 *               severity: { type: string, enum: [low, medium, high, critical] }
 *               timestamp: { type: string, format: date-time }
 *               entities: { type: array, items: { type: object } }
 *               rawRef: { type: string }
 *               incidentId: { type: string, description: Attach to this existing incident instead of creating one. }
 *               triggerPlaybookKey: { type: string, description: Start this playbook against the resulting incident. }
 *     responses:
 *       200:
 *         description: Deduplicated against an alert already ingested for this source/externalId.
 *       201:
 *         description: Attached synchronously to the given incidentId.
 *       202:
 *         description: Accepted — the incident-creation saga has been handed off asynchronously.
 *       400:
 *         description: Validation error.
 *   get:
 *     summary: List alerts
 *     description: >
 *       Two shapes, matched by whether `?incidentId` is present: the unpaginated per-incident list (`?incidentId=X`)
 *       or the tenant-wide, paginated alert inbox (no incidentId).
 *     tags: [Alerts]
 *     parameters:
 *       - in: query
 *         name: incidentId
 *         schema: { type: string }
 *         description: Return only alerts attached to this incident (unpaginated).
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending_case, linked, attached, failed] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A page of alerts (tenant-wide mode) or the full per-incident list.
 */
ingestionRouter.post("/", requireIncidentPermission(ACTION_NAMES.CREATE), asyncHandler(ingestionController.ingestAlertRoute));
ingestionRouter.get("/", requireIncidentPermission(ACTION_NAMES.VIEW), asyncHandler(ingestionController.listAlertsRoute));

/**
 * @openapi
 * /alerts/{id}:
 *   get:
 *     summary: Get an alert by id
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The alert.
 *       400:
 *         description: Invalid alert id.
 *       404:
 *         description: Alert not found.
 */
ingestionRouter.get("/:id", requireIncidentPermission(ACTION_NAMES.VIEW), asyncHandler(ingestionController.getAlertRoute));
