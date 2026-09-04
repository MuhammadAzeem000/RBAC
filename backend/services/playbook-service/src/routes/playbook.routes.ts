import { Router } from "express";
import * as playbookController from "../controllers/playbook.controller";
import { ACTION_NAMES } from "../constants/module";
import { requirePlaybookPermission } from "../middlewares/requirePlaybookPermission";
import { asyncHandler } from "../utils";

export const playbookRouter = Router();

const canView = requirePlaybookPermission(ACTION_NAMES.VIEW);
const canCreate = requirePlaybookPermission(ACTION_NAMES.CREATE);
const canUpdate = requirePlaybookPermission(ACTION_NAMES.UPDATE);

playbookRouter.get("/", canView, asyncHandler(playbookController.listPlaybooks));
playbookRouter.post("/", canCreate, asyncHandler(playbookController.createPlaybook));
playbookRouter.get("/:key", canView, asyncHandler(playbookController.getPlaybook));
playbookRouter.put("/:key", canUpdate, asyncHandler(playbookController.publishPlaybookVersion));
