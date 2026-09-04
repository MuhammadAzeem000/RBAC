import { Router } from "express";
import * as commentController from "../controllers/comment.controller";
import * as evidenceController from "../controllers/evidence.controller";
import * as incidentController from "../controllers/incident.controller";
import * as taskController from "../controllers/task.controller";
import * as timelineController from "../controllers/timeline.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const incidentRouter = Router();

const canView = requireIncidentPermission(ACTION_NAMES.VIEW);
const canCreate = requireIncidentPermission(ACTION_NAMES.CREATE);
const canUpdate = requireIncidentPermission(ACTION_NAMES.UPDATE);
const canDelete = requireIncidentPermission(ACTION_NAMES.DELETE);

/**
 * @openapi
 * /incidents:
 *   post:
 *     summary: Create an incident
 *     tags: [Incidents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, severity]
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               description: { type: string, maxLength: 10000 }
 *               category: { type: string, maxLength: 100 }
 *               severity: { type: string, enum: [low, medium, high, critical] }
 *               priority: { type: string, maxLength: 20 }
 *               tags: { type: array, items: { type: string, maxLength: 50 }, maxItems: 20 }
 *               source: { type: string, maxLength: 100 }
 *               externalId: { type: string, maxLength: 100 }
 *               detectedAt: { type: string, format: date-time }
 *               dueAt: { type: string, format: date-time }
 *               ownerUserId: { type: string, description: Numeric user id. }
 *     responses:
 *       201:
 *         description: The created incident (status starts at "new").
 *       400:
 *         description: Validation error.
 *       403:
 *         description: Caller lacks the Incidents:Create permission.
 *   get:
 *     summary: List incidents
 *     tags: [Incidents]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [new, triage, investigating, containment, remediation, resolved, closed] }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [low, medium, high, critical] }
 *       - in: query
 *         name: ownerUserId
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: source
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive match against title, description, and externalId.
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, severity, updatedAt, dueAt], default: createdAt }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: A page of incidents (excludes soft-deleted rows).
 *       403:
 *         description: Caller lacks the Incidents:View permission.
 */
incidentRouter.post("/", canCreate, asyncHandler(incidentController.createIncident));
incidentRouter.get("/", canView, asyncHandler(incidentController.listIncidents));

/**
 * @openapi
 * /incidents/{id}:
 *   get:
 *     summary: Get an incident by id
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The incident.
 *       400:
 *         description: Invalid incident id.
 *       403:
 *         description: Caller lacks the Incidents:View permission.
 *       404:
 *         description: Incident not found (or soft-deleted).
 *   patch:
 *     summary: Update an incident (classification edits and/or a lifecycle transition)
 *     description: >
 *       One endpoint covers both plain field edits and status transitions. Status can only move forward through
 *       New -> Triage -> Investigating -> Containment -> Remediation -> Resolved -> Closed, except the explicit
 *       reopen path (Closed -> Investigating with `reopen: true`). Closing requires closureCode and
 *       resolutionSummary (either already on the incident or supplied in this request). A closed incident rejects
 *       all other edits until reopened. Pass `version` to opt into optimistic-concurrency checking.
 *     tags: [Incidents]
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
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               description: { type: string, maxLength: 10000 }
 *               category: { type: string, maxLength: 100 }
 *               severity: { type: string, enum: [low, medium, high, critical] }
 *               priority: { type: string, maxLength: 20 }
 *               tags: { type: array, items: { type: string, maxLength: 50 }, maxItems: 20 }
 *               status: { type: string, enum: [new, triage, investigating, containment, remediation, resolved, closed] }
 *               ownerUserId: { type: string, nullable: true, description: Numeric user id. }
 *               dueAt: { type: string, format: date-time, nullable: true }
 *               closureCode: { type: string, maxLength: 50 }
 *               resolutionSummary: { type: string, maxLength: 10000 }
 *               rootCause: { type: string, maxLength: 10000 }
 *               reopen: { type: boolean, description: Set true together with status "investigating" to reopen a closed incident. }
 *               version: { type: integer, description: Optimistic-concurrency check against the incident's current version. }
 *     responses:
 *       200:
 *         description: The updated incident.
 *       400:
 *         description: Validation error, illegal backward status move, closing without closureCode/resolutionSummary, or editing a closed incident.
 *       403:
 *         description: Caller lacks the Incidents:Update permission.
 *       404:
 *         description: Incident not found.
 *       409:
 *         description: Incident was modified by someone else since the given `version`.
 *   delete:
 *     summary: Soft-delete an incident
 *     description: Administrative cleanup for erroneously-created incidents — not part of the normal lifecycle (incidents are normally Closed, not deleted).
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted.
 *       400:
 *         description: Invalid incident id.
 *       403:
 *         description: Caller lacks the Incidents:Delete permission.
 *       404:
 *         description: Incident not found.
 */
incidentRouter.get("/:id", canView, asyncHandler(incidentController.getIncidentById));
incidentRouter.patch("/:id", canUpdate, asyncHandler(incidentController.updateIncident));
incidentRouter.delete("/:id", canDelete, asyncHandler(incidentController.deleteIncident));

/**
 * @openapi
 * /incidents/{id}/comments:
 *   post:
 *     summary: Add a comment to an incident
 *     tags: [Incidents]
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
 *             required: [body]
 *             properties:
 *               body: { type: string, minLength: 1, maxLength: 10000 }
 *     responses:
 *       201:
 *         description: The created comment.
 *       400:
 *         description: Invalid incident id or validation error.
 *       403:
 *         description: Caller lacks the Incidents:Update permission.
 *       404:
 *         description: Incident not found.
 *   get:
 *     summary: List an incident's comments
 *     description: Comments are immutable — there is no edit/delete endpoint.
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: All comments for the incident, oldest first.
 *       400:
 *         description: Invalid incident id.
 *       403:
 *         description: Caller lacks the Incidents:View permission.
 *       404:
 *         description: Incident not found.
 */
incidentRouter.post("/:id/comments", canUpdate, asyncHandler(commentController.createComment));
incidentRouter.get("/:id/comments", canView, asyncHandler(commentController.listComments));

/**
 * @openapi
 * /incidents/{id}/tasks:
 *   post:
 *     summary: Create a task on an incident
 *     tags: [Incidents]
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
 *             required: [title]
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               description: { type: string, maxLength: 5000 }
 *               assigneeUserId: { type: string, description: Numeric user id. }
 *               dueDate: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: The created task (status starts at "open").
 *       400:
 *         description: Invalid incident id or validation error.
 *       403:
 *         description: Caller lacks the Incidents:Update permission.
 *       404:
 *         description: Incident not found.
 *   get:
 *     summary: List an incident's tasks
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: All tasks for the incident, oldest first.
 *       400:
 *         description: Invalid incident id.
 *       403:
 *         description: Caller lacks the Incidents:View permission.
 *       404:
 *         description: Incident not found.
 */
incidentRouter.post("/:id/tasks", canUpdate, asyncHandler(taskController.createTask));
incidentRouter.get("/:id/tasks", canView, asyncHandler(taskController.listTasks));

/**
 * @openapi
 * /incidents/{id}/tasks/{taskId}:
 *   patch:
 *     summary: Update a task
 *     description: Setting `status` to "completed" (from a non-completed status) stamps completedAt/completedBy and emits a task_completed timeline event; any other change emits task_updated.
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 255 }
 *               description: { type: string, maxLength: 5000 }
 *               assigneeUserId: { type: string, nullable: true, description: Numeric user id. }
 *               dueDate: { type: string, format: date-time, nullable: true }
 *               status: { type: string, enum: [open, in_progress, completed, cancelled] }
 *     responses:
 *       200:
 *         description: The updated task.
 *       400:
 *         description: Invalid incident/task id or validation error.
 *       403:
 *         description: Caller lacks the Incidents:Update permission.
 *       404:
 *         description: Task not found.
 */
incidentRouter.patch("/:id/tasks/:taskId", canUpdate, asyncHandler(taskController.updateTask));

/**
 * @openapi
 * /incidents/{id}/evidence:
 *   post:
 *     summary: Attach an evidence record to an incident
 *     description: Registers a reference to evidence already stored elsewhere (storageRef) — this endpoint does not accept file uploads itself.
 *     tags: [Incidents]
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
 *             required: [filename, storageRef]
 *             properties:
 *               filename: { type: string, maxLength: 255 }
 *               fileType: { type: string, maxLength: 100 }
 *               sizeBytes: { type: integer, minimum: 0 }
 *               storageRef: { type: string, maxLength: 500 }
 *               checksum: { type: string, maxLength: 128 }
 *               provenance: { type: string, maxLength: 2000 }
 *     responses:
 *       201:
 *         description: The created evidence record.
 *       400:
 *         description: Invalid incident id or validation error.
 *       403:
 *         description: Caller lacks the Incidents:Update permission.
 *       404:
 *         description: Incident not found.
 *   get:
 *     summary: List an incident's evidence records
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: All evidence records for the incident, most recently uploaded first.
 *       400:
 *         description: Invalid incident id.
 *       403:
 *         description: Caller lacks the Incidents:View permission.
 *       404:
 *         description: Incident not found.
 */
incidentRouter.post("/:id/evidence", canUpdate, asyncHandler(evidenceController.addEvidence));
incidentRouter.get("/:id/evidence", canView, asyncHandler(evidenceController.listEvidence));

/**
 * @openapi
 * /incidents/{id}/timeline:
 *   get:
 *     summary: Get an incident's timeline (paginated)
 *     description: >
 *       The incident's full audit/UX activity feed — created, status/severity changes, assignment, comments,
 *       tasks, evidence, and playbook/approval entries recorded machine-to-machine via POST
 *       /incidents/{id}/timeline (see server.ts).
 *     tags: [Timeline]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: A page of timeline entries, most recent first.
 *       400:
 *         description: Invalid incident id.
 *       403:
 *         description: Caller lacks the Incidents:View permission.
 *       404:
 *         description: Incident not found.
 */
incidentRouter.get("/:id/timeline", canView, asyncHandler(timelineController.getTimeline));
