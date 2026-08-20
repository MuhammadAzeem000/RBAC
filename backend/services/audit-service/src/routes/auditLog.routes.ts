import { Router } from "express";
import * as auditLogController from "../controllers/auditLog.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireAuditPermission } from "../middlewares/requireAuditPermission";
import { asyncHandler } from "../utils";

export const auditLogRouter = Router();

auditLogRouter.get("/", requireAuditPermission(ACTION_NAMES.VIEW), asyncHandler(auditLogController.listAuditLogs));
