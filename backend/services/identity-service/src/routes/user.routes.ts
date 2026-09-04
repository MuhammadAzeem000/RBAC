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

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users
 *     description: Tenant-scoped (mounted behind tenantContext) — returns only the caller's tenant's users.
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: A page of users.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:View permission.
 *   post:
 *     summary: Create a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, maxLength: 150 }
 *               email: { type: string, format: email, maxLength: 255 }
 *               password: { type: string, minLength: 8, maxLength: 255 }
 *     responses:
 *       201:
 *         description: The created user.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:Create permission.
 *       409:
 *         description: A user with this email already exists for the tenant.
 */
userRouter.get("/", canView, asyncHandler(userController.getUsers));
userRouter.post("/", canCreate, asyncHandler(userController.createUser));

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by id
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The user.
 *       400:
 *         description: Invalid user id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:View permission.
 *       404:
 *         description: User not found.
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 150 }
 *               email: { type: string, format: email, maxLength: 255 }
 *               password: { type: string, minLength: 8, maxLength: 255 }
 *               status: { type: string, maxLength: 30 }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: The updated user.
 *       400:
 *         description: Invalid user id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:Update permission.
 *       404:
 *         description: User not found.
 *       409:
 *         description: You can't change your own active status.
 *   delete:
 *     summary: Delete a user
 *     description: Rejected if the target is the caller's own account.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted.
 *       400:
 *         description: Invalid user id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:Delete permission.
 *       404:
 *         description: User not found.
 *       409:
 *         description: You can't delete your own account.
 */
userRouter.get("/:id", canView, asyncHandler(userController.getUserById));
userRouter.put("/:id", canUpdate, asyncHandler(userController.updateUser));
userRouter.delete("/:id", canDelete, asyncHandler(userController.deleteUser));

/**
 * @openapi
 * /users/{id}/roles:
 *   get:
 *     summary: List roles assigned to a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: A page of roles assigned to the user, each with its assignedAt timestamp.
 *       400:
 *         description: Invalid user id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:View permission.
 *       404:
 *         description: User not found.
 *   post:
 *     summary: Assign a role to a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId]
 *             properties:
 *               roleId: { type: string }
 *     responses:
 *       201:
 *         description: The created assignment.
 *       400:
 *         description: Invalid user id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:Update permission.
 *       404:
 *         description: User or role not found.
 *       409:
 *         description: This role is already assigned to the user.
 */
userRouter.get("/:id/roles", canView, asyncHandler(userRoleController.getRolesForUser));
userRouter.post("/:id/roles", canUpdate, asyncHandler(userRoleController.assignRoleToUser));

/**
 * @openapi
 * /users/{id}/roles/{roleId}:
 *   delete:
 *     summary: Revoke a role from a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Revoked.
 *       400:
 *         description: Invalid user or role id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:Update permission.
 *       404:
 *         description: Role assignment not found.
 */
userRouter.delete("/:id/roles/:roleId", canUpdate, asyncHandler(userRoleController.revokeRoleFromUser));

/**
 * @openapi
 * /users/{id}/departments:
 *   get:
 *     summary: List departments assigned to a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: A page of departments assigned to the user, each with isPrimary and its assignedAt timestamp.
 *       400:
 *         description: Invalid user id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:View permission.
 *       404:
 *         description: User not found.
 *   post:
 *     summary: Assign a department to a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [departmentId]
 *             properties:
 *               departmentId: { type: string }
 *               isPrimary: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: The created assignment.
 *       400:
 *         description: Invalid user id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:Update permission.
 *       404:
 *         description: User or department not found.
 *       409:
 *         description: This department is already assigned to the user.
 */
userRouter.get("/:id/departments", canView, asyncHandler(userDepartmentController.getDepartmentsForUser));
userRouter.post("/:id/departments", canUpdate, asyncHandler(userDepartmentController.assignDepartmentToUser));

/**
 * @openapi
 * /users/{id}/departments/{departmentId}:
 *   delete:
 *     summary: Revoke a department from a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Revoked.
 *       400:
 *         description: Invalid user or department id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Users:Update permission.
 *       404:
 *         description: Department assignment not found.
 */
userRouter.delete(
  "/:id/departments/:departmentId",
  canUpdate,
  asyncHandler(userDepartmentController.revokeDepartmentFromUser),
);
