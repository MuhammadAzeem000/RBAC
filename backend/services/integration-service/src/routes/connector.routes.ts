import { Router } from "express";
import * as connectorController from "../controllers/connector.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireConnectorPermission } from "../middlewares/requireConnectorPermission";
import { asyncHandler } from "../utils";

// Human-facing, JWT-authenticated only — server.ts mounts `authenticate` +
// `tenantContext` ahead of this router. The machine-to-machine action route
// (POST /:key/actions/:action) is DELIBERATELY NOT here: it needs
// requireServiceToken instead of authenticate (see requireServiceToken.ts),
// and mounting it under this router would put it behind `authenticate` too,
// which defeats the whole point since Temporal Activities have no user JWT
// to send. It's registered directly in server.ts instead, before this
// router, so Express matches it first and `authenticate` never runs for it.
export const connectorRouter = Router();

const canView = requireConnectorPermission(ACTION_NAMES.VIEW);
const canUpdate = requireConnectorPermission(ACTION_NAMES.UPDATE);

/**
 * @openapi
 * /connectors:
 *   get:
 *     summary: List connectors
 *     description: >
 *       Every connector this tenant can configure, not just the ones already set up — a Connector row is lazily
 *       created (disabled, no credential) the first time it's looked up for a tenant.
 *     tags: [Connectors]
 *     responses:
 *       200:
 *         description: Every connector this tenant can configure, with credential-configured status and available actionKeys.
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
 *                       key: { type: string, example: slack }
 *                       name: { type: string }
 *                       type: { type: string }
 *                       status: { type: string, enum: [enabled, disabled] }
 *                       credentialConfigured: { type: boolean }
 *                       actionKeys:
 *                         type: array
 *                         items: { type: string }
 *                         description: Action names this connector exposes, excluding "test".
 *       401:
 *         description: Invalid or expired token.
 *       503:
 *         description: identity-service unreachable while checking permissions.
 */
connectorRouter.get("/", canView, asyncHandler(connectorController.listConnectors));

/**
 * @openapi
 * /connectors/{key}/credentials:
 *   put:
 *     summary: Set (or replace) a connector's credentials
 *     description: Encrypts and stores the credential, then flips the connector's status to "enabled".
 *     tags: [Connectors]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         description: Connector key, e.g. slack, virustotal, smtp, qradar, fortigate, crowdstrike, defender.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Connector-specific credential fields (e.g. an API token, a webhook URL, SMTP auth).
 *     responses:
 *       204:
 *         description: Credentials stored.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Invalid or expired token.
 *       403:
 *         description: Missing the Connectors:Update permission.
 *       404:
 *         description: Unknown connector key.
 *       503:
 *         description: identity-service unreachable while checking permissions.
 */
connectorRouter.put("/:key/credentials", canUpdate, asyncHandler(connectorController.setCredentials));

/**
 * @openapi
 * /connectors/{key}/test:
 *   post:
 *     summary: Test a connector's stored credentials
 *     description: Runs the connector's "test" action (connection validation only — never exposed as a playbook step action).
 *     tags: [Connectors]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         description: Connector key, e.g. slack, virustotal, smtp, qradar, fortigate, crowdstrike, defender.
 *     responses:
 *       200:
 *         description: >
 *           The test ran (success or failure is reported inside the body, not via HTTP status — see `ok`).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 result: { type: object, description: Present when ok is true. }
 *                 error:
 *                   type: object
 *                   description: Present when ok is false.
 *                   properties:
 *                     message: { type: string }
 *                     retryable: { type: boolean }
 *       401:
 *         description: Invalid or expired token.
 *       403:
 *         description: Missing the Connectors:Update permission.
 *       404:
 *         description: Unknown connector key.
 *       409:
 *         description: Connector has no credentials configured.
 *       429:
 *         description: Rate limit exceeded for this connector.
 *       503:
 *         description: identity-service unreachable while checking permissions.
 */
connectorRouter.post("/:key/test", canUpdate, asyncHandler(connectorController.testConnector));
