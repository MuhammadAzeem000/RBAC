// Kept in sync with the MODULE_NAMES.THREAT_INTEL / ACTION_NAMES values in
// backend/services/identity-service/src/constants/rbac.ts — this is the
// contract requireThreatIntelPermission checks against via identity-service's
// GET /api/auth/me/modules response.
export const MODULE_NAMES = {
  THREAT_INTEL: "Threat Intel",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
} as const;
