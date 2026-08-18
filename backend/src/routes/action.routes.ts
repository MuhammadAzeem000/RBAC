import { Router } from "express";
import * as actionController from "../controllers/action.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const actionRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.DELETE);

actionRouter.get("/", canView, asyncHandler(actionController.getActions));
actionRouter.get("/:id", canView, asyncHandler(actionController.getActionById));
actionRouter.post("/", canCreate, asyncHandler(actionController.createAction));
actionRouter.put("/:id", canUpdate, asyncHandler(actionController.updateAction));
actionRouter.delete("/:id", canDelete, asyncHandler(actionController.deleteAction));
