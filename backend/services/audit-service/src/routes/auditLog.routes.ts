import { Router } from "express";
import * as auditLogController from "../controllers/auditLog.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireAuditPermission } from "../middlewares/requireAuditPermission";
import { asyncHandler } from "../utils";

export const auditLogRouter = Router();

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     summary: List audit log entries
 *     description: >
 *       Reads the central, authoritative audit log — rows land here via each service's own transactional outbox,
 *       consumed and persisted idempotently by this service (see events/consumer.ts). There is no write endpoint.
 *     tags: [Audit Logs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: service
 *         schema: { type: string, maxLength: 50 }
 *         description: Filter to events published by this service (e.g. "incident-service").
 *       - in: query
 *         name: resourceType
 *         schema: { type: string, maxLength: 50 }
 *         description: Filter to events about this resource type (e.g. "INCIDENT").
 *       - in: query
 *         name: actorId
 *         schema: { type: string, maxLength: 100 }
 *         description: Filter to events attributed to this actor id.
 *     responses:
 *       200:
 *         description: A page of audit log entries, ordered by occurredAt descending.
 *       401:
 *         description: Missing or invalid access token.
 *       403:
 *         description: Caller lacks the Audit Logs:View permission.
 */
auditLogRouter.get("/", requireAuditPermission(ACTION_NAMES.VIEW), asyncHandler(auditLogController.listAuditLogs));
