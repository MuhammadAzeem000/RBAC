import { Router } from "express";
import * as auditLogController from "../controllers/auditLog.controller";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const auditLogRouter = Router();

auditLogRouter.get(
  "/",
  requireModulePermission("Audit Logs", "View"),
  asyncHandler(auditLogController.getAuditLogs),
);
