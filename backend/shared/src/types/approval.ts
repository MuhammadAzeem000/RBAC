import { z } from "zod";

// Human authorization gate for disruptive actions (MVP plan §4 and §5). In
// Phase 1 this maps onto incident-service's PlaybookRun.approvedBy/approvedAt
// columns; a standalone Approval table with policy/expiry is Phase 4's work.
export const approvalDecisionSchema = z.enum(["pending", "approved", "rejected", "expired"]);
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const approvalSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  executionId: z.string(),
  requestorUserId: z.string(),
  approverUserId: z.string().nullable(),
  policy: z.string().nullable(),
  decision: approvalDecisionSchema,
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type Approval = z.infer<typeof approvalSchema>;
