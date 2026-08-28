import { Router } from "express";
import * as playbookRunController from "../controllers/playbookRun.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const playbookRunRouter = Router();

const canView = requireIncidentPermission(ACTION_NAMES.VIEW);
const canUpdate = requireIncidentPermission(ACTION_NAMES.UPDATE);

playbookRunRouter.post("/", canUpdate, asyncHandler(playbookRunController.startPlaybookRun));
playbookRunRouter.get("/", canView, asyncHandler(playbookRunController.listPlaybookRuns));
playbookRunRouter.get("/:id", canView, asyncHandler(playbookRunController.getPlaybookRun));
playbookRunRouter.post("/:id/cancel", canUpdate, asyncHandler(playbookRunController.cancelPlaybookRun));
