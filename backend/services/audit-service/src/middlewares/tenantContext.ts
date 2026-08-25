import { NextFunction, Request, Response } from "express";
import { forTenant } from "@responderx/shared";
import { prisma } from "../config/prisma";

// AuditLog is the only model in this service's schema, and it's tenant-owned
// like every other table in this retrofit — see the tenant_id column added
// to it in prisma/schema.prisma.
const TENANT_SCOPED_MODELS = ["AuditLog"] as const;

export type TenantScopedPrisma = typeof prisma;

declare global {
  namespace Express {
    interface Request {
      db: TenantScopedPrisma;
    }
  }
}

// Runs after `authenticate` — attaches a client that can only ever see rows
// belonging to req.auth.tenantId, so a controller/service that forgets to
// filter by tenant can no longer leak across tenants by construction.
export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  req.db = forTenant(prisma, req.auth!.tenantId, TENANT_SCOPED_MODELS);
  next();
}
