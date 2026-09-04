import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { authenticate } from "./middlewares/authenticate";
import { requireServiceToken } from "./middlewares/requireServiceToken";
import { tenantContext } from "./middlewares/tenantContext";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import * as ingestionController from "./controllers/ingestion.controller";
import { ingestionRouter } from "./routes/ingestion.routes";
import { isSwaggerEnabled, swaggerSpec, swaggerUiOptions } from "./config/swagger";
import { startOutboxPublisher } from "./services/outboxPublisher.service";
import { connectConsumer } from "./events/consumer";
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
// production (no auth of its own, and the spec itself isn't secret, but
// there's no reason to ship a debugging UI to prod).
if (isSwaggerEnabled) {
  app.get("/api-docs.json", (_req: Request, res: Response) => res.json(swaggerSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

/**
 * @openapi
 * /alerts/system:
 *   post:
 *     summary: Ingest a normalized alert (machine-to-machine)
 *     description: >
 *       Called by normalization-service once it has parsed a vendor SIEM/EDR webhook into the canonical alert shape.
 *       Always takes the async ingest-and-create-a-case path (never an incidentId — a vendor payload never targets
 *       an existing incident).
 *     tags: [Alerts]
 *     security: [{ serviceToken: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [source, externalId, severity, timestamp, entities, tenantId]
 *             properties:
 *               source: { type: string, example: splunk }
 *               externalId: { type: string }
 *               severity: { type: string, enum: [low, medium, high, critical] }
 *               timestamp: { type: string, format: date-time }
 *               entities: { type: array, items: { type: object } }
 *               rawRef: { type: string }
 *               tenantId: { type: string, description: Resolved by normalization-service from the inbound webhook token. }
 *     responses:
 *       200:
 *         description: Deduplicated against an alert already ingested for this source/externalId.
 *       202:
 *         description: Accepted — the incident-creation saga has been handed off asynchronously.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Missing or invalid X-Service-Token.
 */
app.post(
  "/api/v1/alerts/system",
  requireServiceToken,
  tenantContext,
  asyncHandler(ingestionController.ingestAlertSystemRoute),
);

app.use("/api/v1/alerts", authenticate, tenantContext, ingestionRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`alert-ingestion-service listening on port ${PORT}`);
});

// Outbound half of the incident-creation saga (ALERT_INGESTED → alert.events)
// and the ordinary audit-trail delivery — see outboxPublisher.service.ts.
startOutboxPublisher();

// Inbound half — incident-service's reply once the incident is created (or
// fails). See events/consumer.ts.
void connectConsumer();
