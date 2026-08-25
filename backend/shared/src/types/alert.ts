import { z } from "zod";
import { entitySchema } from "./entity";

// Canonical alert shape (MVP plan §4): preserves source lineage
// (source/externalId/rawRef) while exposing a vendor-neutral schema every
// downstream playbook step consumes instead of a source SIEM's own format.
export const alertSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

export const alertSchema = z.object({
  tenantId: z.string(),
  source: z.string().min(1),
  externalId: z.string().min(1),
  severity: alertSeveritySchema,
  timestamp: z.string(),
  entities: z.array(entitySchema).default([]),
  rawRef: z.string().nullable(),
});

export type Alert = z.infer<typeof alertSchema>;

export const ingestAlertSchema = alertSchema.omit({ tenantId: true });
export type IngestAlertInput = z.infer<typeof ingestAlertSchema>;
