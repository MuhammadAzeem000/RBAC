import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import * as connectorController from "./controllers/connector.controller";
import { authenticate } from "./middlewares/authenticate";
import { requireServiceToken } from "./middlewares/requireServiceToken";
import { tenantContext } from "./middlewares/tenantContext";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { connectorRouter } from "./routes/connector.routes";
import { isSwaggerEnabled, swaggerSpec, swaggerUiOptions } from "./config/swagger";
import { startOutboxPublisher } from "./services/outboxPublisher.service";
import { asyncHandler } from "./utils";

const app = express();
const PORT = env.PORT;

app.use(
  cors({
    origin: env.CORS_ORIGINS,
  }),
);
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Dev-only interactive API docs — see config/swagger.ts. Never mounted in
// production.
if (isSwaggerEnabled) {
  app.get("/api-docs.json", (_req: Request, res: Response) => res.json(swaggerSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

/**
 * @openapi
 * /connectors/{key}/actions/{action}:
 *   post:
 *     summary: Execute a connector action (machine-to-machine)
 *     description: >
 *       Called by incident-service's Temporal Activity when a playbook step runs a connector action — no user JWT
 *       exists in that context, so this route is gated by a shared X-Service-Token instead of authenticate, with
 *       tenantId passed explicitly in the body.
 *     tags: [Connectors]
 *     security: [{ serviceToken: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         description: Connector key, e.g. slack, virustotal, smtp, qradar, fortigate, crowdstrike, defender.
 *       - in: path
 *         name: action
 *         required: true
 *         schema: { type: string }
 *         description: Action name defined on the connector, e.g. sendMessage, lookupHash.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId]
 *             properties:
 *               tenantId: { type: string, description: Already consumed by requireServiceToken, re-validated here for shape. }
 *               params: { type: object, additionalProperties: true, description: Action-specific parameters. }
 *     responses:
 *       200:
 *         description: >
 *           The action ran (success or failure is reported inside the body, not via HTTP status — see `ok`).
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
 *       400:
 *         description: Validation error, or missing tenantId.
 *       401:
 *         description: Missing or invalid X-Service-Token.
 *       404:
 *         description: Unknown connector key or action.
 *       409:
 *         description: Connector has no credentials configured.
 *       429:
 *         description: Rate limit exceeded for this connector.
 */
// Registered BEFORE the authenticate-gated router below, and matched first
// by Express for this exact path+method — the one route called
// machine-to-machine (incident-service's Temporal Activity, no user JWT to
// send), gated by a shared service token instead. See requireServiceToken.ts.
app.post(
  "/api/connectors/:key/actions/:action",
  requireServiceToken,
  tenantContext,
  asyncHandler(connectorController.executeConnectorActionRoute),
);

app.use("/api/connectors", authenticate, tenantContext, connectorRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`integration-service listening on port ${PORT}`);
});

// Delivers this service's transactional-outbox rows to audit-service — see
// services/outbox.service.ts (the write side) and outboxPublisher.service.ts
// (this, the delivery side).
startOutboxPublisher();
