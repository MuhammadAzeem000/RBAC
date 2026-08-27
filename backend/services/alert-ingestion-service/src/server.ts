import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { authenticate } from "./middlewares/authenticate";
import { tenantContext } from "./middlewares/tenantContext";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { ingestionRouter } from "./routes/ingestion.routes";
import { startOutboxPublisher } from "./services/outboxPublisher.service";
import { connectConsumer } from "./events/consumer";

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
