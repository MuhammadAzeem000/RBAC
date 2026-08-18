import { Router } from "express";
import * as roleController from "../controllers/role.controller";
import * as rolePermissionController from "../controllers/rolePermission.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const roleRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.ROLES, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.ROLES, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.ROLES, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.ROLES, ACTION_NAMES.DELETE);

roleRouter.get("/", canView, asyncHandler(roleController.getRoles));
roleRouter.get("/:id", canView, asyncHandler(roleController.getRoleById));
roleRouter.post("/", canCreate, asyncHandler(roleController.createRole));
roleRouter.put("/:id", canUpdate, asyncHandler(roleController.updateRole));
roleRouter.delete("/:id", canDelete, asyncHandler(roleController.deleteRole));

roleRouter.get("/:id/permissions", canView, asyncHandler(rolePermissionController.getPermissionsForRole));
roleRouter.post("/:id/permissions", canUpdate, asyncHandler(rolePermissionController.assignPermissionToRole));
roleRouter.delete(
  "/:id/permissions/:permissionId",
  canUpdate,
  asyncHandler(rolePermissionController.revokePermissionFromRole),
);
