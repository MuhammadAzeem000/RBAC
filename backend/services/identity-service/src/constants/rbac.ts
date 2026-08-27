// Single source of truth for module/action name strings used both to seed
// permissions (bootstrap.service.ts) and to gate routes
// (requireModulePermission(...) call sites). A typo in either place would
// otherwise silently make a permission unreachable — nobody could ever be
// granted it, since it just wouldn't match.
export const MODULE_NAMES = {
  DASHBOARD: "Dashboard",
  USERS: "Users",
  DEPARTMENTS: "Departments",
  ROLES: "Roles",
  MODULES: "Modules",
  ACTIONS: "Actions",
  PERMISSIONS: "Permissions",
  AUDIT_LOGS: "Audit Logs",
  INCIDENTS: "Incidents",
  // Platform-level, not per-tenant: deliberately excluded from the
  // "grant every module to the new Administrator role" loop in
  // bootstrap.service.ts, since Administrator is the role every tenant's
  // own first admin gets. Nobody holds this permission until a genuine
  // platform operator is granted it explicitly, the same way any other
  // permission is granted — through the existing Roles/Permissions UI.
  TENANTS: "Tenants",
  CONNECTORS: "Connectors",
} as const;

export const ACTION_NAMES = {
  VIEW: "View",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
} as const;
