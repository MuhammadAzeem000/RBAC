// Kept in sync with the MODULE_NAMES.CONNECTORS / ACTION_NAMES values in
// backend/services/identity-service/src/constants/rbac.ts — a webhook
// source is conceptually an inbound integration point, so it's gated on
// the existing Connectors module rather than a new one (same reasoning as
// every prior slice's "reuse an existing module" calls).
export const MODULE_NAMES = {
  CONNECTORS: "Connectors",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
} as const;
