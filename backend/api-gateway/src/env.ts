import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  IDENTITY_SERVICE_URL: z.string().url().default("http://localhost:4000"),
});

export const env = envSchema.parse(process.env);
