import { Router } from "express";
import * as alertController from "../controllers/alert.controller";
import * as commentController from "../controllers/comment.controller";
import * as evidenceController from "../controllers/evidence.controller";
import * as incidentController from "../controllers/incident.controller";
import * as playbookRunController from "../controllers/playbookRun.controller";
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

// Static path registered before "/:id" so it isn't swallowed by the param route.
incidentRouter.get("/playbook-catalog", canView, asyncHandler(playbookRunController.listPlaybookCatalog));

incidentRouter.post("/", canCreate, asyncHandler(incidentController.createIncident));
incidentRouter.get("/", canView, asyncHandler(incidentController.listIncidents));
incidentRouter.get("/:id", canView, asyncHandler(incidentController.getIncidentById));
incidentRouter.patch("/:id", canUpdate, asyncHandler(incidentController.updateIncident));
incidentRouter.delete("/:id", canDelete, asyncHandler(incidentController.deleteIncident));

incidentRouter.post("/:id/alerts", canUpdate, asyncHandler(alertController.attachAlert));
incidentRouter.get("/:id/alerts", canView, asyncHandler(alertController.listAlerts));

incidentRouter.post("/:id/comments", canUpdate, asyncHandler(commentController.createComment));
incidentRouter.get("/:id/comments", canView, asyncHandler(commentController.listComments));

incidentRouter.post("/:id/tasks", canUpdate, asyncHandler(taskController.createTask));
incidentRouter.get("/:id/tasks", canView, asyncHandler(taskController.listTasks));
incidentRouter.patch("/:id/tasks/:taskId", canUpdate, asyncHandler(taskController.updateTask));

incidentRouter.post("/:id/evidence", canUpdate, asyncHandler(evidenceController.addEvidence));
incidentRouter.get("/:id/evidence", canView, asyncHandler(evidenceController.listEvidence));

incidentRouter.post("/:id/playbook-runs", canUpdate, asyncHandler(playbookRunController.startPlaybookRun));
incidentRouter.get("/:id/playbook-runs", canView, asyncHandler(playbookRunController.listPlaybookRuns));
incidentRouter.post(
  "/:id/playbook-runs/:runId/cancel",
  canUpdate,
  asyncHandler(playbookRunController.cancelPlaybookRun),
);

incidentRouter.get("/:id/timeline", canView, asyncHandler(timelineController.getTimeline));
