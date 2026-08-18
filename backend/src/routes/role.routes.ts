import { Router } from "express";
import * as roleController from "../controllers/role.controller";
import * as rolePermissionController from "../controllers/rolePermission.controller";
import { asyncHandler } from "../utils";

export const roleRouter = Router();

roleRouter.get("/", asyncHandler(roleController.getRoles));
roleRouter.get("/:id", asyncHandler(roleController.getRoleById));
roleRouter.post("/", asyncHandler(roleController.createRole));
roleRouter.put("/:id", asyncHandler(roleController.updateRole));
roleRouter.delete("/:id", asyncHandler(roleController.deleteRole));

roleRouter.get("/:id/permissions", asyncHandler(rolePermissionController.getPermissionsForRole));
roleRouter.post("/:id/permissions", asyncHandler(rolePermissionController.assignPermissionToRole));
roleRouter.delete(
  "/:id/permissions/:permissionId",
  asyncHandler(rolePermissionController.revokePermissionFromRole),
);
