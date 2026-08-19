// Kept in sync with the MODULE_NAMES.AUDIT_LOGS / ACTION_NAMES values in
// backend/services/identity-service/src/constants/rbac.ts — this is the
// contract requireAuditPermission checks against via identity-service's
// GET /api/auth/me/modules response. "Audit Logs" already exists in
// identity-service's RBAC (it seeded the audit-log route identity-service
// used to own) — no new module needs seeding for this service.
export const MODULE_NAMES = {
  AUDIT_LOGS: "Audit Logs",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
} as const;
