import { z } from "zod";
import { ingestAlertSchema } from "@responderx/shared";

// The canonical shape (source, externalId, severity, timestamp, entities[],
// rawRef) comes straight from @responderx/shared — no re-declaration here.
// triggerPlaybookKey is the one field specific to this endpoint: optionally
// kick off a playbook run against the newly-created incident, reusing
// Phase 2-4's orchestration untouched (see ingestion.service.ts).
export const ingestAlertRequestSchema = ingestAlertSchema.extend({
  triggerPlaybookKey: z.string().trim().min(1).max(100).optional(),
});

export type IngestAlertRequest = z.infer<typeof ingestAlertRequestSchema>;
