import { z } from "zod";
import { ingestAlertSchema } from "@responderx/shared";
import { paginationQuerySchema } from "./pagination";

// The canonical shape (source, externalId, severity, timestamp, entities[],
// rawRef) comes straight from @responderx/shared. incidentId is the one
// addition that distinguishes the two entry paths this endpoint now serves
// (see ingestion.service.ts): given -> synchronous attach to an existing
// incident; omitted -> async ingest-and-create-a-case saga.
export const ingestAlertRequestSchema = ingestAlertSchema.extend({
  incidentId: z
    .string()
    .regex(/^\d+$/, "incidentId must be a numeric id")
    .optional(),
  triggerPlaybookKey: z.string().trim().min(1).max(100).optional(),
});

export type IngestAlertRequest = z.infer<typeof ingestAlertRequestSchema>;

// System-triggered variant (POST /api/v1/alerts/system) — normalization-service
// calling in with a tenantId resolved from a webhook token, no incidentId
// (a vendor payload never targets an existing incident) and no
// triggerPlaybookKey (not a feature of this entry path).
export const ingestAlertSystemSchema = ingestAlertSchema.extend({
  tenantId: z.string().regex(/^\d+$/, "tenantId must be a numeric id"),
});

export type IngestAlertSystemRequest = z.infer<typeof ingestAlertSystemSchema>;

// GET /api/v1/alerts with no incidentId — a tenant-wide, paginated alert
// inbox (the per-incident list, GET /api/v1/alerts?incidentId=X, stays
// unpaginated and unchanged — see controllers/ingestion.controller.ts's
// branch on whether incidentId is present).
export const listAlertsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending_case", "linked", "attached", "failed"]).optional(),
  search: z.string().trim().min(1).max(255).optional(),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
