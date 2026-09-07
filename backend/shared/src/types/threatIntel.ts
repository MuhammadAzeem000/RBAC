import { z } from "zod";

// threat-intelligence-service's IOC lookup contract (GET
// /service/iocs/lookup and its human-facing twin GET /iocs/lookup) — shared
// so a future integration-service connector action or normalization-service
// enrichment step can't drift from the handler's actual response shape.
// Same rationale as connector.ts's connectorActionRequestSchema/-ResponseSchema.
export const iocLookupResponseSchema = z.object({
  found: z.boolean(),
  stixId: z.string().optional(),
  iocType: z.string().nullable().optional(),
  iocValue: z.string().nullable().optional(),
  type: z.string().optional(),
  labels: z.array(z.string()).optional(),
  confidence: z.number().nullable().optional(),
  firstSeen: z.coerce.date().nullable().optional(),
  lastSeen: z.coerce.date().nullable().optional(),
  sourceFeedName: z.string().nullable().optional(),
});
export type IocLookupResponse = z.infer<typeof iocLookupResponseSchema>;
