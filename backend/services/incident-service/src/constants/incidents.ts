// Single source of truth for incident lifecycle/classification strings —
// mirrors the pattern in identity-service's constants/rbac.ts (one place to
// change so seed data, validation, and the state machine can never drift).
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

// Ordered list defines both valid values AND the forward-progress rank used
// by the lifecycle state machine (see services/incident.service.ts).
export const STATUSES = [
  "new",
  "triage",
  "investigating",
  "containment",
  "remediation",
  "resolved",
  "closed",
] as const;
export type Status = (typeof STATUSES)[number];

export const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PLAYBOOK_RUN_STATES = ["pending_approval", "running", "succeeded", "failed", "cancelled"] as const;
export type PlaybookRunState = (typeof PLAYBOOK_RUN_STATES)[number];

// Fixed example catalog standing in for a real playbook engine's registry —
// there is no SOAR automation engine in this codebase (see schema.prisma's
// PlaybookRun comment). `requiresApproval` drives the spec's "explicit
// confirmation/approval for actions marked destructive or high risk" rule.
export const PLAYBOOK_CATALOG = [
  {
    key: "enrich-ioc",
    name: "Enrich Indicators of Compromise",
    description: "Look up reputation/context for IPs, domains, and hashes referenced by the incident.",
    requiresApproval: false,
  },
  {
    key: "isolate-host",
    name: "Isolate Host",
    description: "Network-isolate an affected endpoint to contain active spread.",
    requiresApproval: true,
  },
  {
    key: "disable-user-account",
    name: "Disable User Account",
    description: "Disable a compromised user account pending investigation.",
    requiresApproval: true,
  },
  {
    key: "reset-credentials",
    name: "Reset Credentials",
    description: "Force a credential reset for an affected account.",
    requiresApproval: true,
  },
  {
    key: "notify-stakeholders",
    name: "Notify Stakeholders",
    description: "Send a status update to the configured incident stakeholder list.",
    requiresApproval: false,
  },
] as const;

export type PlaybookKey = (typeof PLAYBOOK_CATALOG)[number]["key"];

export function findPlaybook(key: string) {
  return PLAYBOOK_CATALOG.find((p) => p.key === key) ?? null;
}
