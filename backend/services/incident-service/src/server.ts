import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { authenticate } from "./middlewares/authenticate";
import { requireServiceToken } from "./middlewares/requireServiceToken";
import { tenantContext } from "./middlewares/tenantContext";
import { connectEventBus } from "./events/eventBus.service";
import { errorHandler } from "./middlewares/errorHandler";
import * as timelineController from "./controllers/timeline.controller";
import { incidentRouter } from "./routes/incident.routes";
import { notFound } from "./middlewares/notFound";
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

// Registered BEFORE the authenticate-gated router below, and matched first
// by Express for this exact path+method — the one route called
// machine-to-machine (playbook-service's Temporal Activities, no user JWT
// to send), gated by a shared service token instead. See
// requireServiceToken.ts. Phase 5.2: TimelineEvent stays owned by this
// service even though the Playbook/Orchestration/Approval subsystem that
// writes most entries to it moved out.
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
