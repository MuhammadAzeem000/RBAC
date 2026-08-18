import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { authenticate } from "./middlewares/authenticate";
import { connectEventBus } from "./events/eventBus.service";
import { errorHandler } from "./middlewares/errorHandler";
import { incidentRouter } from "./routes/incident.routes";
import { notFound } from "./middlewares/notFound";

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

// Matches the spec's documented REST surface (section 6.1) exactly:
// /api/v1/incidents/... — every route requires a valid identity-service
// access token; per-action permission checks happen inside incidentRouter
// via requireIncidentPermission (which calls identity-service).
app.use("/api/v1/incidents", authenticate, incidentRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`incident-service listening on port ${PORT}`);
});

// Fire-and-forget: connects in the background with its own retry loop, so a
// slow-starting or temporarily unreachable broker never delays the server
// from accepting requests.
void connectEventBus();
