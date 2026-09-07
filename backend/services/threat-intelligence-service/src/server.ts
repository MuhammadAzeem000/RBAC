import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import * as iocController from "./controllers/ioc.controller";
import { authenticate } from "./middlewares/authenticate";
import { requireServiceToken } from "./middlewares/requireServiceToken";
import { tenantContext } from "./middlewares/tenantContext";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { taxiiServerRouter } from "./routes/taxiiServer.routes";
import { taxiiCollectionRouter } from "./routes/taxiiCollection.routes";
import { iocRouter } from "./routes/ioc.routes";
import { stixObjectRouter } from "./routes/stixObject.routes";
import { isSwaggerEnabled, swaggerSpec, swaggerUiOptions } from "./config/swagger";
import { startOutboxPublisher } from "./services/outboxPublisher.service";
import { startTaxiiPoller } from "./services/taxiiPoller.service";
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
 * /service/iocs/lookup:
 *   get:
 *     summary: Look up a single IOC value (machine-to-machine)
 *     description: >
 *       Called by a future integration-service connector action or normalization-service enrichment step — no user
 *       JWT exists in that context, so this route is gated by a shared X-Service-Token instead of authenticate, with
 *       tenantId passed explicitly in the query. Distinct path from the human-facing GET /iocs/lookup (same
 *       underlying lookup, different auth mechanism) — see requireServiceToken.ts.
 *     tags: [IOCs]
 *     security: [{ serviceToken: [] }]
 *     parameters:
 *       - in: query
 *         name: value
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: found=false when no match exists; otherwise the matched indicator's details.
 *       400:
 *         description: Missing value or tenantId.
 *       401:
 *         description: Missing or invalid X-Service-Token.
 */
// Registered BEFORE the authenticate-gated routers below, at a distinct path
// (not the human-facing /iocs/lookup) — the one route called
// machine-to-machine, gated by a shared service token instead of a user JWT.
// See requireServiceToken.ts, same convention as integration-service's
// POST /connectors/:key/actions/:action.
app.get(
  "/api/v1/threat-intel/service/iocs/lookup",
  requireServiceToken,
  tenantContext,
  asyncHandler(iocController.lookupIoc),
);

app.use("/api/v1/threat-intel", authenticate, tenantContext, taxiiServerRouter);
app.use("/api/v1/threat-intel", authenticate, tenantContext, taxiiCollectionRouter);
app.use("/api/v1/threat-intel/iocs", authenticate, tenantContext, iocRouter);
app.use("/api/v1/threat-intel/stix-objects", authenticate, tenantContext, stixObjectRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`threat-intelligence-service listening on port ${PORT}`);
});

// Delivers this service's transactional-outbox rows to audit-service and
// (for IOC_INGESTED rows) threat-intel.events — see
// services/outbox.service.ts (the write side) and outboxPublisher.service.ts
// (this, the delivery side).
startOutboxPublisher();

// Scheduled TAXII 2.1 collection polling — see services/taxiiPoller.service.ts.
startTaxiiPoller();
