import { Prisma } from "../generated/prisma/client";

// Read-only for now — Policy authoring (create/update timeout/escalation
// config) is a genuinely separate feature from the Playbook Designer this
// supports, deferred rather than bundled in (see the Playbook Designer
// plan's decision 7). Today Policy rows are seed-only
// (constants/playbooks.ts's POLICY_SEED_DATA via prisma/seed.ts); this just
// lets the designer's approval-gate picker show what already exists.
export interface PolicyResponse {
  key: string;
  name: string;
  timeoutDuration: string;
  escalationAfter: string | null;
  escalationChannel: string | null;
}

const policySelect = {
  key: true,
  name: true,
  timeoutDuration: true,
  escalationAfter: true,
  escalationChannel: true,
} as const;

export function listPolicies(db: Prisma.TransactionClient): Promise<PolicyResponse[]> {
  return db.policy.findMany({ select: policySelect, orderBy: { key: "asc" } });
}
