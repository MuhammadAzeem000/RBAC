import { Router } from "express";
import * as auditLogController from "../controllers/auditLog.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const auditLogRouter = Router();

auditLogRouter.get(
  "/",
  requireModulePermission(MODULE_NAMES.AUDIT_LOGS, ACTION_NAMES.VIEW),
  asyncHandler(auditLogController.getAuditLogs),
);
