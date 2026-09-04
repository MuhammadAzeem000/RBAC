import { Router } from "express";
import * as departmentController from "../controllers/department.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const departmentRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.DELETE);

/**
 * @openapi
 * /departments:
 *   get:
 *     summary: List departments
 *     description: Tenant-scoped (mounted behind tenantContext) — returns only the caller's tenant's departments.
 *     tags: [Departments]
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
 *         description: A page of departments.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Departments:View permission.
 *   post:
 *     summary: Create a department
 *     tags: [Departments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 150 }
 *               description: { type: string }
 *               sortOrder: { type: integer }
 *     responses:
 *       201:
 *         description: The created department.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Departments:Create permission.
 *       409:
 *         description: A department with this name already exists for the tenant.
 */
departmentRouter.get("/", canView, asyncHandler(departmentController.getDepartments));
departmentRouter.post("/", canCreate, asyncHandler(departmentController.createDepartment));

/**
 * @openapi
 * /departments/{id}:
 *   get:
 *     summary: Get a department by id
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The department.
 *       400:
 *         description: Invalid department id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Departments:View permission.
 *       404:
 *         description: Department not found.
 *   put:
 *     summary: Update a department
 *     tags: [Departments]
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
 *               sortOrder: { type: integer }
 *               status: { type: string, maxLength: 30 }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: The updated department.
 *       400:
 *         description: Invalid department id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Departments:Update permission.
 *       404:
 *         description: Department not found.
 *       409:
 *         description: You can't change the active status of a department you belong to.
 *   delete:
 *     summary: Delete a department
 *     description: Rejected if the caller belongs to it, or if any user is still assigned to it.
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted.
 *       400:
 *         description: Invalid department id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Departments:Delete permission.
 *       404:
 *         description: Department not found.
 *       409:
 *         description: You belong to this department, or it still has users assigned to it.
 */
departmentRouter.get("/:id", canView, asyncHandler(departmentController.getDepartmentById));
departmentRouter.put("/:id", canUpdate, asyncHandler(departmentController.updateDepartment));
departmentRouter.delete("/:id", canDelete, asyncHandler(departmentController.deleteDepartment));
