// Kept in sync with the MODULE_NAMES.INCIDENTS / ACTION_NAMES values in
// backend/services/identity-service/src/constants/rbac.ts — same contract
// incident-service's own requireIncidentPermission checks against. No new
// RBAC module for this split: ingesting/attaching an alert is, mechanically,
// creating/viewing an incident (see the Phase 5.1 plan's reasoning).
export const MODULE_NAMES = {
  INCIDENTS: "Incidents",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
} as const;
