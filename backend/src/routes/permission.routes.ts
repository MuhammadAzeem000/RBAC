import { Router } from "express";
import * as permissionController from "../controllers/permission.controller";
import { asyncHandler } from "../utils";

export const permissionRouter = Router();

permissionRouter.get("/", asyncHandler(permissionController.getPermissions));
permissionRouter.get("/:id", asyncHandler(permissionController.getPermissionById));
permissionRouter.post("/", asyncHandler(permissionController.createPermission));
permissionRouter.put("/:id", asyncHandler(permissionController.updatePermission));
permissionRouter.delete("/:id", asyncHandler(permissionController.deletePermission));
