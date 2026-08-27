import { z } from "zod";

// A playbook step, kept intentionally opaque (`config`) in Phase 1 — the
// real DAG/step model (conditions, parallel branches, retries) is Phase 2's
// concern once a durable workflow engine is chosen. This shape only needs to
// be enough to replace the hardcoded PLAYBOOK_CATALOG constant with real,
// versioned rows.
//
// `connector`/`action` (Phase 3): when set, the step executes through the
// connector runtime (integration-service) instead of running simulated —
// `config` becomes that action's params. Both are optional and independent
// of `config`'s own shape so every pre-Phase-3 step (neither field set)
// keeps running exactly as before.
export const playbookStepSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  connector: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type PlaybookStep = z.infer<typeof playbookStepSchema>;

// Immutable versioned workflow definition (MVP plan §4). A running
// Execution stays bound to the PlaybookVersion it started with — "version
// pinning" — even if a newer version is published later.
export const playbookVersionSchema = z.object({
  id: z.string(),
  playbookId: z.string(),
  version: z.string().min(1),
  requiresApproval: z.boolean(),
  steps: z.array(playbookStepSchema).default([]),
  createdAt: z.string(),
});
export type PlaybookVersion = z.infer<typeof playbookVersionSchema>;

export const playbookSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
});
export type Playbook = z.infer<typeof playbookSchema>;
