import { z } from "zod";

// Analyst-facing incident record (MVP plan §4 calls this "Case"; this
// codebase's incident-service models it as `Incident` — same concept, kept
// under both names deliberately: `Case` is the plan's vocabulary, `Incident`
// is this repo's existing table/route name, and Phase 1 doesn't rename it).
export const caseStatusSchema = z.enum(["open", "investigating", "contained", "resolved", "closed"]);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const caseSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type CaseSeverity = z.infer<typeof caseSeveritySchema>;

export const caseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  status: caseStatusSchema,
  severity: caseSeveritySchema,
  ownerUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export type Case = z.infer<typeof caseSchema>;
