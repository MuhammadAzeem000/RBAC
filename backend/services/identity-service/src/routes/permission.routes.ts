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

/**
 * @openapi
 * /permissions:
 *   get:
 *     summary: List permissions
 *     description: A permission is a (moduleId, actionId) pair — e.g. (Users, Create) — that a role can hold.
 *     tags: [Permissions]
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
 *       - in: query
 *         name: moduleId
 *         schema: { type: string }
 *       - in: query
 *         name: actionId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A page of permissions.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Permissions:View permission.
 *   post:
 *     summary: Create a permission
 *     tags: [Permissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moduleId, actionId, name]
 *             properties:
 *               moduleId: { type: string }
 *               actionId: { type: string }
 *               name: { type: string, maxLength: 150 }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: The created permission.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Permissions:Create permission.
 *       409:
 *         description: A permission for this module/action pair already exists.
 */
permissionRouter.get("/", canView, asyncHandler(permissionController.getPermissions));
permissionRouter.post("/", canCreate, asyncHandler(permissionController.createPermission));

/**
 * @openapi
 * /permissions/{id}:
 *   get:
 *     summary: Get a permission by id
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The permission.
 *       400:
 *         description: Invalid permission id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Permissions:View permission.
 *       404:
 *         description: Permission not found.
 *   put:
 *     summary: Update a permission
 *     description: The module/action pair is immutable after creation — only name, description, and isActive can change.
 *     tags: [Permissions]
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
 *               description: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: The updated permission.
 *       400:
 *         description: Invalid permission id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Permissions:Update permission.
 *       404:
 *         description: Permission not found.
 *   delete:
 *     summary: Delete a permission
 *     description: Rejected if the permission is still assigned to any role.
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted.
 *       400:
 *         description: Invalid permission id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Permissions:Delete permission.
 *       404:
 *         description: Permission not found.
 *       409:
 *         description: This permission is still assigned to one or more roles.
 */
permissionRouter.get("/:id", canView, asyncHandler(permissionController.getPermissionById));
permissionRouter.put("/:id", canUpdate, asyncHandler(permissionController.updatePermission));
permissionRouter.delete("/:id", canDelete, asyncHandler(permissionController.deletePermission));
