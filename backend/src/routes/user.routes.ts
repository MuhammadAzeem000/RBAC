import { Router } from "express";
import * as userController from "../controllers/user.controller";
import * as userRoleController from "../controllers/userRole.controller";
import * as userDepartmentController from "../controllers/userDepartment.controller";
import { asyncHandler } from "../utils";

export const userRouter = Router();

userRouter.get("/", asyncHandler(userController.getUsers));
userRouter.get("/:id", asyncHandler(userController.getUserById));
userRouter.post("/", asyncHandler(userController.createUser));
userRouter.put("/:id", asyncHandler(userController.updateUser));
userRouter.delete("/:id", asyncHandler(userController.deleteUser));

userRouter.get("/:id/roles", asyncHandler(userRoleController.getRolesForUser));
userRouter.post("/:id/roles", asyncHandler(userRoleController.assignRoleToUser));
userRouter.delete("/:id/roles/:roleId", asyncHandler(userRoleController.revokeRoleFromUser));

userRouter.get("/:id/departments", asyncHandler(userDepartmentController.getDepartmentsForUser));
userRouter.post("/:id/departments", asyncHandler(userDepartmentController.assignDepartmentToUser));
userRouter.delete(
  "/:id/departments/:departmentId",
  asyncHandler(userDepartmentController.revokeDepartmentFromUser),
);
