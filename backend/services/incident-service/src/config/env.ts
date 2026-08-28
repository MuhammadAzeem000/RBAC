import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const envSchema = z.object({
  PORT: z.coerce.number().default(4200),
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
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174"),
  RABBITMQ_URL: z.string().min(1).default("amqp://localhost:5672"),
  // Guards POST /api/v1/incidents/:id/timeline — the one route called
  // machine-to-machine, from playbook-service's Temporal Activities (Phase
  // 5.2's split moved Playbook/Orchestration/Approval out; TimelineEvent
  // stayed here). See middlewares/requireServiceToken.ts.
  INCIDENT_SERVICE_TOKEN: z.string().min(16),
  // The reverse direction: events/alertConsumer.ts's triggerPlaybookKey
  // handling has no user JWT (it runs from a RabbitMQ consumer, not a
  // request) to start a playbook run with, so it calls playbook-service's
  // own machine-to-machine route instead.
  PLAYBOOK_SERVICE_URL: z.string().url().default("http://localhost:4600"),
  PLAYBOOK_SERVICE_TOKEN: z.string().min(16),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  DATABASE_URL: `postgresql://${encodeURIComponent(parsed.DB_USER)}:${encodeURIComponent(parsed.DB_PASSWORD)}@${parsed.DB_HOST}:${parsed.DB_PORT}/${parsed.DB_NAME}?schema=public`,
  CORS_ORIGINS: parsed.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
};
