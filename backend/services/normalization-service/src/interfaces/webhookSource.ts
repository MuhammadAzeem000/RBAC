import { z } from "zod";

// Kept in sync with parsers/registry.ts's PARSER_REGISTRY keys.
export const createWebhookSourceSchema = z.object({
  vendor: z.enum(["splunk", "sentinel", "crowdstrike", "generic"]),
  label: z.string().trim().min(1).max(150),
});

export type CreateWebhookSourceRequest = z.infer<typeof createWebhookSourceSchema>;
