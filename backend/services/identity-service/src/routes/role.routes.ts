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

/**
 * @openapi
 * /roles:
 *   get:
 *     summary: List roles
 *     tags: [Roles]
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
 *         description: A page of roles.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:View permission.
 *   post:
 *     summary: Create a role
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: The created role.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:Create permission.
 *       409:
 *         description: A role with this name already exists.
 */
roleRouter.get("/", canView, asyncHandler(roleController.getRoles));
roleRouter.post("/", canCreate, asyncHandler(roleController.createRole));

/**
 * @openapi
 * /roles/{id}:
 *   get:
 *     summary: Get a role by id
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The role.
 *       400:
 *         description: Invalid role id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:View permission.
 *       404:
 *         description: Role not found.
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
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
 *               name: { type: string, maxLength: 100 }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: The updated role.
 *       400:
 *         description: Invalid role id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:Update permission.
 *       404:
 *         description: Role not found.
 *       409:
 *         description: You can't change the active status of a role assigned to your own account.
 *   delete:
 *     summary: Delete a role
 *     description: Rejected if the role is assigned to the caller's own account, or to any other user.
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted.
 *       400:
 *         description: Invalid role id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:Delete permission.
 *       404:
 *         description: Role not found.
 *       409:
 *         description: The role is assigned to the caller's own account, or to one or more users.
 */
roleRouter.get("/:id", canView, asyncHandler(roleController.getRoleById));
roleRouter.put("/:id", canUpdate, asyncHandler(roleController.updateRole));
roleRouter.delete("/:id", canDelete, asyncHandler(roleController.deleteRole));

/**
 * @openapi
 * /roles/{id}/permissions:
 *   get:
 *     summary: List permissions assigned to a role
 *     tags: [Roles]
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
 *         description: A page of permissions assigned to the role, each with its assignedAt timestamp.
 *       400:
 *         description: Invalid role id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:View permission.
 *       404:
 *         description: Role not found.
 *   post:
 *     summary: Assign a permission to a role
 *     tags: [Roles]
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
 *             required: [permissionId]
 *             properties:
 *               permissionId: { type: string }
 *     responses:
 *       201:
 *         description: The created assignment.
 *       400:
 *         description: Invalid role id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:Update permission.
 *       404:
 *         description: Role or permission not found.
 *       409:
 *         description: This permission is already assigned to the role.
 */
roleRouter.get("/:id/permissions", canView, asyncHandler(rolePermissionController.getPermissionsForRole));
roleRouter.post("/:id/permissions", canUpdate, asyncHandler(rolePermissionController.assignPermissionToRole));

/**
 * @openapi
 * /roles/{id}/permissions/{permissionId}:
 *   delete:
 *     summary: Revoke a permission from a role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Revoked.
 *       400:
 *         description: Invalid role or permission id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Roles:Update permission.
 *       404:
 *         description: Permission assignment not found.
 */
roleRouter.delete(
  "/:id/permissions/:permissionId",
  canUpdate,
  asyncHandler(rolePermissionController.revokePermissionFromRole),
);
