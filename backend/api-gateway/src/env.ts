import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:4000"),
  INCIDENT_SERVICE_URL: z.string().url().default("http://localhost:4200"),
  PLAYBOOK_SERVICE_URL: z.string().url().default("http://localhost:4600"),
  AUDIT_SERVICE_URL: z.string().url().default("http://localhost:4400"),
  INTEGRATION_SERVICE_URL: z.string().url().default("http://localhost:4300"),
  ALERT_INGESTION_SERVICE_URL: z.string().url().default("http://localhost:4500"),
  NORMALIZATION_SERVICE_URL: z.string().url().default("http://localhost:4700"),
  THREAT_INTELLIGENCE_SERVICE_URL: z.string().url().default("http://localhost:4800"),
});

export const env = envSchema.parse(process.env);
