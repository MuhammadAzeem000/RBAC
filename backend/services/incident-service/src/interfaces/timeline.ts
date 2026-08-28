import { z } from "zod";

// Body shape for the machine-to-machine POST /api/v1/incidents/:id/timeline
// route (see middlewares/requireServiceToken.ts) — tenantId is consumed by
// that middleware, re-validated here for shape, same convention as
// integration-service's executeActionSchema.
export const recordTimelineEventSchema = z.object({
  tenantId: z.string().regex(/^\d+$/),
  eventType: z.string().trim().min(1).max(50),
  actorUserId: z.string().regex(/^\d+$/).optional(),
  summary: z.string().trim().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RecordTimelineEventInput = z.infer<typeof recordTimelineEventSchema>;
