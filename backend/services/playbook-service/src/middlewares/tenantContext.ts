import { NextFunction, Request, Response } from "express";
import { forTenant } from "@responderx/shared";
import { prisma } from "../config/prisma";

const TENANT_SCOPED_MODELS = [
  "Playbook",
  "PlaybookVersion",
  "Policy",
  "PlaybookRun",
  "StepExecution",
  "Approval",
  "OutboxEvent",
] as const;

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
