import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import * as connectorController from "./controllers/connector.controller";
import { authenticate } from "./middlewares/authenticate";
import { requireServiceToken } from "./middlewares/requireServiceToken";
import { tenantContext } from "./middlewares/tenantContext";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { connectorRouter } from "./routes/connector.routes";
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
