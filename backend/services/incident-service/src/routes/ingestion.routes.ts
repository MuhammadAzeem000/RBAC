import { Router } from "express";
import * as ingestionController from "../controllers/ingestion.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const ingestionRouter = Router();

// Ingesting an alert is, mechanically, creating an incident — gated on the
// same Incidents:Create permission POST /incidents already uses, not a new
// module (see the Phase 5 plan's reasoning for not inventing new
// machine-credential infrastructure this phase).
ingestionRouter.post("/", requireIncidentPermission(ACTION_NAMES.CREATE), asyncHandler(ingestionController.ingestAlert));
