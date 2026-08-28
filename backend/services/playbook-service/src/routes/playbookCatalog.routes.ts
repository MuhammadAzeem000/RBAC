import { Router } from "express";
import * as playbookRunController from "../controllers/playbookRun.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const playbookCatalogRouter = Router();

playbookCatalogRouter.get(
  "/",
  requireIncidentPermission(ACTION_NAMES.VIEW),
  asyncHandler(playbookRunController.listPlaybookCatalog),
);
