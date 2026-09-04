import { Router } from "express";
import * as webhookSourceController from "../controllers/webhookSource.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireConnectorPermission } from "../middlewares/requireConnectorPermission";
import { asyncHandler } from "../utils";

export const webhookSourceRouter = Router();

/**
 * @openapi
 * /webhook-sources:
 *   post:
 *     summary: Create a webhook source
 *     description: >
 *       Generates a new random token for the given vendor and returns the full receive path
 *       (/api/v1/normalize/{vendor}/{token}) to configure in the vendor's own webhook/alert-action settings. The
 *       token is returned on both create and list — there's no separate "reveal once" UI in this slice.
 *     tags: [Webhook Sources]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vendor, label]
 *             properties:
 *               vendor: { type: string, enum: [splunk, sentinel, crowdstrike, generic] }
 *               label: { type: string, minLength: 1, maxLength: 150 }
 *     responses:
 *       201:
 *         description: The created webhook source, including its token and full receivePath.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 vendor: { type: string }
 *                 label: { type: string }
 *                 token: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *                 lastUsedAt: { type: string, format: date-time, nullable: true }
 *                 receivePath: { type: string, example: /api/v1/normalize/splunk/abcd1234... }
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Invalid or expired token.
 *       403:
 *         description: Missing the Connectors:Create permission.
 *       503:
 *         description: identity-service unreachable while checking permissions.
 *   get:
 *     summary: List webhook sources
 *     tags: [Webhook Sources]
 *     responses:
 *       200:
 *         description: Every webhook source configured for this tenant, including tokens and receive paths.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       vendor: { type: string }
 *                       label: { type: string }
 *                       token: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       lastUsedAt: { type: string, format: date-time, nullable: true }
 *                       receivePath: { type: string }
 *       401:
 *         description: Invalid or expired token.
 *       403:
 *         description: Missing the Connectors:View permission.
 *       503:
 *         description: identity-service unreachable while checking permissions.
 */
webhookSourceRouter.post(
  "/",
  requireConnectorPermission(ACTION_NAMES.CREATE),
  asyncHandler(webhookSourceController.createWebhookSourceRoute),
);
webhookSourceRouter.get(
  "/",
  requireConnectorPermission(ACTION_NAMES.VIEW),
  asyncHandler(webhookSourceController.listWebhookSourcesRoute),
);
