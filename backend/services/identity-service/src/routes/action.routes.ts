import { Router } from "express";
import * as actionController from "../controllers/action.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const actionRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.ACTIONS, ACTION_NAMES.DELETE);

/**
 * @openapi
 * /actions:
 *   get:
 *     summary: List actions
 *     description: Actions are the RBAC verbs (View/Create/Update/Delete) that combine with a module to form a permission.
 *     tags: [Actions]
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
 *         description: A page of actions.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Actions:View permission.
 *   post:
 *     summary: Create an action
 *     tags: [Actions]
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
 *               sortOrder: { type: integer }
 *     responses:
 *       201:
 *         description: The created action.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Actions:Create permission.
 */
actionRouter.get("/", canView, asyncHandler(actionController.getActions));
actionRouter.post("/", canCreate, asyncHandler(actionController.createAction));

/**
 * @openapi
 * /actions/{id}:
 *   get:
 *     summary: Get an action by id
 *     tags: [Actions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The action.
 *       400:
 *         description: Invalid action id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Actions:View permission.
 *       404:
 *         description: Action not found.
 *   put:
 *     summary: Update an action
 *     tags: [Actions]
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
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: The updated action.
 *       400:
 *         description: Invalid action id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Actions:Update permission.
 *       404:
 *         description: Action not found.
 *   delete:
 *     summary: Delete an action
 *     description: Soft-deletes the action. Rejected if any permission still references it.
 *     tags: [Actions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted.
 *       400:
 *         description: Invalid action id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Actions:Delete permission.
 *       409:
 *         description: This action still has permissions defined for it.
 */
actionRouter.get("/:id", canView, asyncHandler(actionController.getActionById));
actionRouter.put("/:id", canUpdate, asyncHandler(actionController.updateAction));
actionRouter.delete("/:id", canDelete, asyncHandler(actionController.deleteAction));
