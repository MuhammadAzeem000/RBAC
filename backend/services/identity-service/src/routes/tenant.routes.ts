import { Router } from "express";
import * as tenantController from "../controllers/tenant.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const tenantRouter = Router();

// Nobody holds these permissions by default — see MODULE_NAMES.TENANTS and
// ensureTenantsModuleSeeded(). A platform operator is granted access here
// the same way any permission is granted anywhere else in this system:
// through the Roles/Permissions UI.
const canView = requireModulePermission(MODULE_NAMES.TENANTS, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.TENANTS, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.TENANTS, ACTION_NAMES.UPDATE);

/**
 * @openapi
 * /tenants:
 *   get:
 *     summary: List tenants
 *     description: Platform-level — nobody holds Tenants:View by default; it must be granted explicitly to a platform operator.
 *     tags: [Tenants]
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
 *     responses:
 *       200:
 *         description: A page of tenants.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Tenants:View permission.
 *   post:
 *     summary: Create a tenant
 *     tags: [Tenants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slug, name]
 *             properties:
 *               slug:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 63
 *                 pattern: '^[a-z0-9]+(-[a-z0-9]+)*$'
 *               name: { type: string, maxLength: 150 }
 *     responses:
 *       201:
 *         description: The created tenant.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Tenants:Create permission.
 *       409:
 *         description: A tenant with this slug already exists.
 */
tenantRouter.get("/", canView, asyncHandler(tenantController.getTenants));
tenantRouter.post("/", canCreate, asyncHandler(tenantController.createTenant));

/**
 * @openapi
 * /tenants/{id}:
 *   get:
 *     summary: Get a tenant by id
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The tenant.
 *       400:
 *         description: Invalid tenant id.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Tenants:View permission.
 *       404:
 *         description: Tenant not found.
 *   put:
 *     summary: Update a tenant
 *     tags: [Tenants]
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
 *               status: { type: string, enum: [active, suspended] }
 *     responses:
 *       200:
 *         description: The updated tenant.
 *       400:
 *         description: Invalid tenant id or validation error.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks Tenants:Update permission.
 *       404:
 *         description: Tenant not found.
 */
tenantRouter.get("/:id", canView, asyncHandler(tenantController.getTenantById));
tenantRouter.put("/:id", canUpdate, asyncHandler(tenantController.updateTenant));
