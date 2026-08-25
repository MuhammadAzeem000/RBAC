import { NextFunction, Request, Response } from "express";
import { forTenant } from "@responderx/shared";
import { prisma } from "../config/prisma";

// Every model in this service is tenant-owned (unlike identity-service,
// which excludes global platform taxonomy) — see the tenantId column added
// to every table in prisma/schema.prisma. Playbook/PlaybookVersion are
// scoped too, since each tenant has its own playbook catalog.
const TENANT_SCOPED_MODELS = [
  "Incident",
  "Alert",
  "Task",
  "Evidence",
  "Comment",
  "PlaybookRun",
  "TimelineEvent",
  "OutboxEvent",
  "Playbook",
  "PlaybookVersion",
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
