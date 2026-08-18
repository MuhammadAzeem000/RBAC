import { Router } from "express";
import * as permissionController from "../controllers/permission.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const permissionRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.PERMISSIONS, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.PERMISSIONS, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.PERMISSIONS, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.PERMISSIONS, ACTION_NAMES.DELETE);

permissionRouter.get("/", canView, asyncHandler(permissionController.getPermissions));
permissionRouter.get("/:id", canView, asyncHandler(permissionController.getPermissionById));
permissionRouter.post("/", canCreate, asyncHandler(permissionController.createPermission));
permissionRouter.put("/:id", canUpdate, asyncHandler(permissionController.updatePermission));
permissionRouter.delete("/:id", canDelete, asyncHandler(permissionController.deletePermission));
