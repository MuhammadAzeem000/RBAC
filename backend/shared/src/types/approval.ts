import { z } from "zod";

// Human authorization gate for disruptive actions (MVP plan §4 and §5).
// Phase 4: a real, standalone Approval table (incident-service) backs this
// shape — one row per gate (a playbook's start, or an individual step),
// referencing a named Policy (below) for its timeout/escalation config.
export const approvalDecisionSchema = z.enum(["pending", "approved", "rejected", "expired"]);
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const approvalSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  executionId: z.string(),
  // Which gate within the run this is — null for the playbook-start gate,
  // a step key for a per-step gate (see playbook.ts's PlaybookStep.policyKey).
  stepKey: z.string().nullable(),
  requestorUserId: z.string(),
  approverUserId: z.string().nullable(),
  policy: z.string().nullable(),
  decision: approvalDecisionSchema,
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  escalatedAt: z.string().nullable(),
});
export type Approval = z.infer<typeof approvalSchema>;

// A named, reusable approval configuration — what an Approval's `policy`
// field references. Timeout/escalation live here instead of being
// hardcoded per playbook, so the same policy can gate many steps/playbooks
// consistently.
export const policySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  key: z.string().min(1),
  name: z.string().min(1),
  // Temporal duration strings (e.g. "24 hours") — see incident-service's
  // config/env.ts PLAYBOOK_APPROVAL_TIMEOUT for the same format.
  timeoutDuration: z.string().min(1),
  escalationAfter: z.string().nullable(),
  escalationChannel: z.string().nullable(),
});
export type Policy = z.infer<typeof policySchema>;
