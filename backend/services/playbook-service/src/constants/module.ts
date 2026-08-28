// Kept in sync with the MODULE_NAMES.INCIDENTS/APPROVALS / ACTION_NAMES
// values in backend/services/identity-service/src/constants/rbac.ts — same
// contract incident-service's own requireIncidentPermission/
// requireApprovalPermission check against. No new RBAC module for this
// split: playbook catalog/runs are gated the same as before (Incidents:*),
// and approvals keep their own existing module.
export const MODULE_NAMES = {
  INCIDENTS: "Incidents",
  APPROVALS: "Approvals",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
} as const;
