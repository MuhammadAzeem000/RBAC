import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { authenticate } from "./middlewares/authenticate";
import { connectConsumer } from "./events/consumer";
import { errorHandler } from "./middlewares/errorHandler";
import { auditLogRouter } from "./routes/auditLog.routes";
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

// The single authoritative audit-log store's read API — replaces
// identity-service's old GET /api/audit-logs (the gateway now routes that
// path here instead).
app.use("/api/audit-logs", authenticate, auditLogRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`audit-service listening on port ${PORT}`);
});

// Fire-and-forget: connects in the background with its own retry loop, so a
// slow-starting or temporarily unreachable broker never delays the server
// from accepting requests.
void connectConsumer();
