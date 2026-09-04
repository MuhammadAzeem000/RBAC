import { Router } from "express";
import * as moduleController from "../controllers/module.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const moduleRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.MODULES, ACTION_NAMES.DELETE);

/**
 * @openapi
 * /modules:
 *   get:
 *     summary: List modules
 *     description: Modules are the RBAC nouns (e.g. Users, Incidents) that combine with an action to form a permission, and drive nav visibility.
 *     tags: [Modules]
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
 *         description: A page of modules.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Modules:View permission.
 *   post:
 *     summary: Create a module
 *     tags: [Modules]
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
 *               icon: { type: string, maxLength: 100 }
 *               route: { type: string, maxLength: 255 }
 *               sortOrder: { type: integer }
 *     responses:
 *       201:
 *         description: The created module.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Modules:Create permission.
 */
moduleRouter.get("/", canView, asyncHandler(moduleController.getModules));
moduleRouter.post("/", canCreate, asyncHandler(moduleController.createModule));

/**
 * @openapi
 * /modules/{id}:
 *   get:
 *     summary: Get a module by id
 *     tags: [Modules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The module.
 *       400:
 *         description: Invalid module id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Modules:View permission.
 *       404:
 *         description: Module not found.
 *   put:
 *     summary: Update a module
 *     tags: [Modules]
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
 *               icon: { type: string, maxLength: 100 }
 *               route: { type: string, maxLength: 255 }
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: The updated module.
 *       400:
 *         description: Invalid module id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Modules:Update permission.
 *       404:
 *         description: Module not found.
 *   delete:
 *     summary: Delete a module
 *     description: Soft-deletes the module. Rejected if any permission still references it.
 *     tags: [Modules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted.
 *       400:
 *         description: Invalid module id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Modules:Delete permission.
 *       404:
 *         description: Module not found.
 *       409:
 *         description: This module still has permissions defined for it.
 */
moduleRouter.get("/:id", canView, asyncHandler(moduleController.getModuleById));
moduleRouter.put("/:id", canUpdate, asyncHandler(moduleController.updateModule));
moduleRouter.delete("/:id", canDelete, asyncHandler(moduleController.deleteModule));
