import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { authenticate } from "./middlewares/authenticate";
import { requireServiceToken } from "./middlewares/requireServiceToken";
import { tenantContext } from "./middlewares/tenantContext";
import { connectEventBus } from "./events/eventBus.service";
import { errorHandler } from "./middlewares/errorHandler";
import * as timelineController from "./controllers/timeline.controller";
import { incidentRouter } from "./routes/incident.routes";
import { notFound } from "./middlewares/notFound";
import { isSwaggerEnabled, swaggerSpec, swaggerUiOptions } from "./config/swagger";
import { startOutboxPublisher } from "./services/outboxPublisher.service";
import { connectAlertConsumer } from "./events/alertConsumer";
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

// Registered BEFORE the authenticate-gated router below, and matched first
// by Express for this exact path+method — the one route called
// machine-to-machine (playbook-service's Temporal Activities, no user JWT
// to send), gated by a shared service token instead. See
// requireServiceToken.ts. Phase 5.2: TimelineEvent stays owned by this
// service even though the Playbook/Orchestration/Approval subsystem that
// writes most entries to it moved out.
/**
 * @openapi
 * /incidents/{id}/timeline:
 *   post:
 *     summary: Record a timeline event (machine-to-machine)
 *     description: >
 *       Called by playbook-service's Temporal Activities to append a timeline entry for a playbook/approval state
 *       change, since TimelineEvent stays owned by incident-service. Not reachable with a user JWT.
 *     tags: [Timeline]
 *     security: [{ serviceToken: [] }]
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
 *             required: [tenantId, eventType, summary]
 *             properties:
 *               tenantId: { type: string, description: Numeric tenant id as a string. }
 *               eventType: { type: string, example: playbook_step_completed }
 *               actorUserId: { type: string, description: Numeric user id as a string. }
 *               summary: { type: string }
 *               metadata: { type: object }
 *     responses:
 *       201:
 *         description: The recorded timeline entry.
 *       400:
 *         description: Invalid incident id or validation error.
 *       401:
 *         description: Missing or invalid X-Service-Token.
 *       404:
 *         description: Incident not found.
 */
app.post(
  "/api/v1/incidents/:id/timeline",
  requireServiceToken,
  tenantContext,
  asyncHandler(timelineController.recordTimelineEventRoute),
);

// Matches the spec's documented REST surface (section 6.1) exactly:
// /api/v1/incidents/... — every route requires a valid identity-service
// access token; per-action permission checks happen inside incidentRouter
// via requireIncidentPermission (which calls identity-service).
app.use("/api/v1/incidents", authenticate, tenantContext, incidentRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`incident-service listening on port ${PORT}`);
});

// Fire-and-forget: connects in the background with its own retry loop, so a
// slow-starting or temporarily unreachable broker never delays the server
// from accepting requests.
void connectEventBus();

// Delivers this service's transactional-outbox rows to audit-service (and,
// for the reply half of the incident-creation saga, to alert.events too) —
// independent of connectEventBus() above; audit events are not domain events.
startOutboxPublisher();

// Inbound half of the incident-creation saga — alert-ingestion-service's
// ALERT_INGESTED events. See events/alertConsumer.ts.
void connectAlertConsumer();
