import { z } from "zod";

// A normalized indicator/artifact referenced by an Alert or Case — IP,
// domain, URL, user, host, file hash, process, or cloud resource. Kept
// vendor-neutral so playbook steps never depend on a source SIEM/EDR's own
// schema (MVP plan §4, "Design intent" for the Entity row).
export const entityTypeSchema = z.enum([
  "ip",
  "domain",
  "url",
  "user",
  "host",
  "file_hash",
  "process",
  "cloud_resource",
]);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const entitySchema = z.object({
  type: entityTypeSchema,
  value: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export type Entity = z.infer<typeof entitySchema>;
