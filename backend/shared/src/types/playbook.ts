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
//
// `policyKey` (Phase 4): when set, the workflow pauses for human approval
// under that named Policy immediately before running this step — action
// classification is per-step, not per-playbook. The playbook-start gate
// (`PlaybookVersion.startPolicyKey` below) is the same mechanism applied
// once, implicitly, before step 1.
export const playbookStepSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  connector: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  policyKey: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  // Canvas layout only (Phase: branching workflows) — never read by the
  // Temporal workflow. Optional so every step created before this field
  // existed keeps validating unchanged.
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type PlaybookStep = z.infer<typeof playbookStepSchema>;

// Branching workflows: a step's outgoing edge may be guarded by a
// structured condition evaluated against the accumulated outputs of steps
// that already ran (keyed by step `key`). Deliberately not a free-form
// expression language — a fixed operator set keeps evaluation safe (no
// eval) and trivially deterministic for Temporal's replay model.
export const conditionOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "exists",
]);
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;

export const stepConditionSchema = z.object({
  // Dot-path into the run's accumulated step-output context, e.g.
  // "lookup-ip.stats.malicious".
  field: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.unknown().optional(),
});
export type StepCondition = z.infer<typeof stepConditionSchema>;

// A directed edge between two step keys within the same PlaybookVersion.
// An edge with no `condition` is always "activated" once its source step
// executes — this is what makes unconditioned parallel fan-out fall out of
// the same mechanism as conditional branching, with no separate node type.
export const playbookEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  condition: stepConditionSchema.optional(),
});
export type PlaybookEdge = z.infer<typeof playbookEdgeSchema>;

// Immutable versioned workflow definition (MVP plan §4). A running
// Execution stays bound to the PlaybookVersion it started with — "version
// pinning" — even if a newer version is published later.
export const playbookVersionSchema = z.object({
  id: z.string(),
  playbookId: z.string(),
  version: z.string().min(1),
  requiresApproval: z.boolean(),
  // The Policy (see approval.ts) gating the run before its first step —
  // null means the run starts immediately, same as requiresApproval: false
  // did before Phase 4. requiresApproval stays as a cheap denormalized
  // "does this run need approval at all" flag for list views.
  startPolicyKey: z.string().nullable(),
  steps: z.array(playbookStepSchema).default([]),
  // Empty means "no explicit graph" — every consumer (the Temporal
  // workflow, the designer canvas) synthesizes an implicit linear chain
  // (step[i] -> step[i+1], unconditioned) in that case, so every playbook
  // that predates this field keeps executing/rendering exactly as before.
  edges: z.array(playbookEdgeSchema).default([]),
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
