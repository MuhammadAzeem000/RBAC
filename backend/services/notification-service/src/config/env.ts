import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const envSchema = z.object({
  PORT: z.coerce.number().default(4100),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  RABBITMQ_URL: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  DATABASE_URL: `postgresql://${encodeURIComponent(parsed.DB_USER)}:${encodeURIComponent(parsed.DB_PASSWORD)}@${parsed.DB_HOST}:${parsed.DB_PORT}/${parsed.DB_NAME}?schema=public`,
};
