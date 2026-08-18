import { Router } from "express";
import * as userController from "../controllers/user.controller";
import * as userRoleController from "../controllers/userRole.controller";
import * as userDepartmentController from "../controllers/userDepartment.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const userRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.USERS, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.USERS, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.USERS, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.USERS, ACTION_NAMES.DELETE);

userRouter.get("/", canView, asyncHandler(userController.getUsers));
userRouter.get("/:id", canView, asyncHandler(userController.getUserById));
userRouter.post("/", canCreate, asyncHandler(userController.createUser));
userRouter.put("/:id", canUpdate, asyncHandler(userController.updateUser));
userRouter.delete("/:id", canDelete, asyncHandler(userController.deleteUser));

userRouter.get("/:id/roles", canView, asyncHandler(userRoleController.getRolesForUser));
userRouter.post("/:id/roles", canUpdate, asyncHandler(userRoleController.assignRoleToUser));
userRouter.delete("/:id/roles/:roleId", canUpdate, asyncHandler(userRoleController.revokeRoleFromUser));

userRouter.get("/:id/departments", canView, asyncHandler(userDepartmentController.getDepartmentsForUser));
userRouter.post("/:id/departments", canUpdate, asyncHandler(userDepartmentController.assignDepartmentToUser));
userRouter.delete(
  "/:id/departments/:departmentId",
  canUpdate,
  asyncHandler(userDepartmentController.revokeDepartmentFromUser),
);
