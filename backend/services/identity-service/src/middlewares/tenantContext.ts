import { NextFunction, Request, Response } from "express";
import { forTenant } from "@responderx/shared";
import { prisma } from "../config/prisma";

// Tenant-scoped models in this service. Role/Module/Action/Permission/
// RolePermission are deliberately excluded — see the comment on Role in
// prisma/schema.prisma (they're global platform taxonomy, not per-tenant).
const TENANT_SCOPED_MODELS = ["User", "Department", "UserRole", "UserDepartment"] as const;

// forTenant<TClient>(client, ...): TClient — so this is structurally
// identical to `typeof prisma`, which is what makes it safe to pass
// anywhere a service function currently expects `Prisma.TransactionClient`
// (including inside a `req.db.$transaction(async (tx) => ...)` callback:
// Prisma client extensions apply inside interactive transactions run on the
// extended client, so `tx` there stays tenant-scoped too).
export type TenantScopedPrisma = typeof prisma;

declare global {
  namespace Express {
    interface Request {
      db: TenantScopedPrisma;
    }
  }
}

// Runs after `authenticate` — attaches a client that can only ever see rows
// belonging to req.auth.tenantId for the models above, so a controller that
// forgets to filter by tenant can no longer leak across tenants by
// construction. Always scoped to the caller's own tenant; nothing in this
// service currently needs a cross-tenant bypass.
export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  req.db = forTenant(prisma, req.auth!.tenantId, TENANT_SCOPED_MODELS);
  next();
}
