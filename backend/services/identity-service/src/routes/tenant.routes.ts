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

tenantRouter.get("/", canView, asyncHandler(tenantController.getTenants));
tenantRouter.get("/:id", canView, asyncHandler(tenantController.getTenantById));
tenantRouter.post("/", canCreate, asyncHandler(tenantController.createTenant));
tenantRouter.put("/:id", canUpdate, asyncHandler(tenantController.updateTenant));
