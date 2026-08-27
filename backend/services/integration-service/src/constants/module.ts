// Kept in sync with the MODULE_NAMES.CONNECTORS / ACTION_NAMES values in
// backend/services/identity-service/src/constants/rbac.ts — this is the
// contract requireConnectorPermission checks against via identity-service's
// GET /api/auth/me/modules response.
export const MODULE_NAMES = {
  CONNECTORS: "Connectors",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
} as const;
