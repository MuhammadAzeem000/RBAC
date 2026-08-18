import { z } from "zod";

export const attachAlertSchema = z.object({
  externalAlertId: z.string().trim().min(1).max(150),
  source: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(5_000),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

export type AttachAlertInput = z.infer<typeof attachAlertSchema>;
