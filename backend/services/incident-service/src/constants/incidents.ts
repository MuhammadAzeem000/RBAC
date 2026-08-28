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
