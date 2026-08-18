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
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  DATABASE_URL: `postgresql://${encodeURIComponent(parsed.DB_USER)}:${encodeURIComponent(parsed.DB_PASSWORD)}@${parsed.DB_HOST}:${parsed.DB_PORT}/${parsed.DB_NAME}?schema=public`,
  CORS_ORIGINS: parsed.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
};
