import { Router } from "express";
import * as ingestionController from "../controllers/ingestion.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const ingestionRouter = Router();

// Same Incidents:Create/View permissions incident-service already checks for
// its own routes — no new RBAC module for this split (see the plan's
// "Gateway + RBAC" step).
ingestionRouter.post("/", requireIncidentPermission(ACTION_NAMES.CREATE), asyncHandler(ingestionController.ingestAlertRoute));
ingestionRouter.get("/", requireIncidentPermission(ACTION_NAMES.VIEW), asyncHandler(ingestionController.listAlertsRoute));
ingestionRouter.get("/:id", requireIncidentPermission(ACTION_NAMES.VIEW), asyncHandler(ingestionController.getAlertRoute));
