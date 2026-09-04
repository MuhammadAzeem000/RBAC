// Kept in sync with the MODULE_NAMES.INCIDENTS/APPROVALS/PLAYBOOKS /
// ACTION_NAMES values in
// backend/services/identity-service/src/constants/rbac.ts. Playbook
// catalog/runs stay gated on Incidents:* as before; approvals keep their
// own module; authoring a playbook (Playbook Designer) is gated on its own
// Playbooks module — a distinct capability from running one.
export const MODULE_NAMES = {
  INCIDENTS: "Incidents",
  APPROVALS: "Approvals",
  PLAYBOOKS: "Playbooks",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
} as const;
