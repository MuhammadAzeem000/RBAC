import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { authenticate } from "./middlewares/authenticate";
import { requireServiceToken } from "./middlewares/requireServiceToken";
import { tenantContext } from "./middlewares/tenantContext";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import * as playbookRunController from "./controllers/playbookRun.controller";
import { playbookCatalogRouter } from "./routes/playbookCatalog.routes";
import { playbookRunRouter } from "./routes/playbookRun.routes";
import { playbookRouter } from "./routes/playbook.routes";
import { policyRouter } from "./routes/policy.routes";
import { approvalRouter } from "./routes/approval.routes";
import { startOutboxPublisher } from "./services/outboxPublisher.service";
import { connectEventBus } from "./events/eventBus.service";
import { startPlaybookWorker } from "./temporal/worker";
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

// Registered BEFORE the authenticate-gated mount below, and matched first
// by Express for this exact path+method — the one route called
// machine-to-machine (incident-service's alert-ingested consumer, no user
// JWT to send), gated by a shared service token instead. See
// requireServiceToken.ts.
app.post(
  "/api/v1/playbook-runs/system",
  requireServiceToken,
  tenantContext,
  asyncHandler(playbookRunController.startPlaybookRunSystem),
);

app.use("/api/v1/playbook-catalog", authenticate, tenantContext, playbookCatalogRouter);
app.use("/api/v1/playbook-runs", authenticate, tenantContext, playbookRunRouter);
app.use("/api/v1/playbooks", authenticate, tenantContext, playbookRouter);
app.use("/api/v1/policies", authenticate, tenantContext, policyRouter);
app.use("/api/v1/approvals", authenticate, tenantContext, approvalRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`playbook-service listening on port ${PORT}`);
});

// Fire-and-forget: connects in the background with its own retry loop, so a
// slow-starting or temporarily unreachable broker never delays the server
// from accepting requests.
void connectEventBus();

// Delivers this service's transactional-outbox rows to audit-service.
startOutboxPublisher();

// Durable playbook-run execution — see src/temporal/. Runs its own
// reconnect loop (like connectEventBus above), so a slow-starting or
// temporarily unreachable Temporal server never delays request handling.
void startPlaybookWorker();
