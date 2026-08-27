import { z } from "zod";

// The connector runtime's execution contract (Phase 3) — POST
// /connectors/:key/actions/:action request/response shape, shared so
// incident-service's caller and integration-service's handler can't drift.
export const connectorActionRequestSchema = z.object({
  tenantId: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type ConnectorActionRequest = z.infer<typeof connectorActionRequestSchema>;

// `retryable` lets the caller (a Temporal Activity) decide whether to throw
// a plain error (Temporal's own retry policy applies) or a non-retryable
// failure (a 4xx-class error that will never succeed on retry, e.g. bad
// credentials) — see incident-service's temporal/activities.ts.
export const connectorActionErrorSchema = z.object({
  message: z.string(),
  retryable: z.boolean(),
});
export type ConnectorActionError = z.infer<typeof connectorActionErrorSchema>;

export const connectorActionResponseSchema = z.object({
  ok: z.boolean(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: connectorActionErrorSchema.optional(),
});
export type ConnectorActionResponse = z.infer<typeof connectorActionResponseSchema>;
