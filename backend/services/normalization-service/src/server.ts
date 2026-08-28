import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { authenticate } from "./middlewares/authenticate";
import { tenantContext } from "./middlewares/tenantContext";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { webhookSourceRouter } from "./routes/webhookSource.routes";
import { normalizeRouter } from "./routes/normalize.routes";
import { startOutboxPublisher } from "./services/outboxPublisher.service";

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

// Public — a vendor SIEM/EDR sends its own webhook auth (or none), never a
// ResponderX JWT. See routes/normalize.routes.ts.
app.use("/api/v1/normalize", normalizeRouter);

app.use("/api/v1/webhook-sources", authenticate, tenantContext, webhookSourceRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`normalization-service listening on port ${PORT}`);
});

// Delivers this service's transactional-outbox rows to audit-service.
startOutboxPublisher();
