import { NextFunction, Request, Response } from "express";
import { forTenant } from "@responderx/shared";
import { prisma } from "../config/prisma";

// Every model in this service's schema is tenant-owned.
const TENANT_SCOPED_MODELS = ["TaxiiServer", "TaxiiCollection", "StixObject", "OutboxEvent"] as const;

export type TenantScopedPrisma = typeof prisma;

declare global {
  namespace Express {
    interface Request {
      db: TenantScopedPrisma;
    }
  }
}

// Runs after `authenticate` (human-facing routes) or `requireServiceToken`
// (the machine-to-machine IOC-lookup route, which sets req.auth.tenantId
// itself from the query — see requireServiceToken.ts) — attaches a client
// that can only ever see rows belonging to that tenant.
export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  req.db = forTenant(prisma, req.auth!.tenantId, TENANT_SCOPED_MODELS);
  next();
}
