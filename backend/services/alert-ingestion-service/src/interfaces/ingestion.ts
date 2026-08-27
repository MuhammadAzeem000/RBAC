import { z } from "zod";
import { ingestAlertSchema } from "@responderx/shared";

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
