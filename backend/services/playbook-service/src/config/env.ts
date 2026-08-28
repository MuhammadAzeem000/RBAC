import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const envSchema = z.object({
  PORT: z.coerce.number().default(4600),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  // Must match identity-service's JWT_ACCESS_SECRET — this service verifies
  // access tokens identity-service issued, it never issues its own.
  JWT_ACCESS_SECRET: z.string().min(32),
  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:4000"),
  // Two distinct cross-service calls to incident-service: a synchronous READ
  // (verify an incidentId exists before starting a run against it, caller's
  // own JWT forwarded — same pattern as alert-ingestion-service's attach
  // path) and a machine-to-machine WRITE (POST .../timeline from inside a
  // Temporal Activity, which has no request context — service-token authed,
  // same pattern as this service's own call into integration-service below).
  INCIDENT_SERVICE_URL: z.string().url().default("http://localhost:4200"),
  INCIDENT_SERVICE_TOKEN: z.string().min(16),
  // Guards POST /api/v1/playbook-runs/system — the one route called
  // machine-to-machine, from incident-service's alert-ingested consumer
  // (events/alertConsumer.ts's triggerPlaybookKey handling has no user JWT
  // to forward). Same shared-secret pattern as INCIDENT_SERVICE_TOKEN,
  // just in the other direction.
  PLAYBOOK_SERVICE_TOKEN: z.string().min(16),
  // host:port, not a URL — this is what @temporalio/client's Connection.connect()
  // and @temporalio/worker's NativeConnection.connect() both expect for `address`.
  TEMPORAL_ADDRESS: z.string().min(1).default("localhost:7233"),
  // The connector runtime a real (non-simulated) playbook step calls — see
  // temporal/activities.ts's runStep/escalateApproval.
  INTEGRATION_SERVICE_URL: z.string().url().default("http://localhost:4300"),
  INTEGRATION_SERVICE_TOKEN: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174"),
  RABBITMQ_URL: z.string().min(1).default("amqp://localhost:5672"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  DATABASE_URL: `postgresql://${encodeURIComponent(parsed.DB_USER)}:${encodeURIComponent(parsed.DB_PASSWORD)}@${parsed.DB_HOST}:${parsed.DB_PORT}/${parsed.DB_NAME}?schema=public`,
  CORS_ORIGINS: parsed.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
};
