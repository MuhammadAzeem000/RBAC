import { Router } from "express";
import * as moduleController from "../controllers/module.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const moduleRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.DELETE);

moduleRouter.get("/", canView, asyncHandler(moduleController.getModules));
moduleRouter.get("/:id", canView, asyncHandler(moduleController.getModuleById));
moduleRouter.post("/", canCreate, asyncHandler(moduleController.createModule));
moduleRouter.put("/:id", canUpdate, asyncHandler(moduleController.updateModule));
moduleRouter.delete("/:id", canDelete, asyncHandler(moduleController.deleteModule));
