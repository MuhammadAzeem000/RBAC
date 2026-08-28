import { NextFunction, Request, Response } from "express";
import { forTenant } from "@responderx/shared";
import { prisma } from "../config/prisma";

const TENANT_SCOPED_MODELS = ["WebhookSource", "OutboxEvent"] as const;

export type TenantScopedPrisma = typeof prisma;

declare global {
  namespace Express {
    interface Request {
      db: TenantScopedPrisma;
    }
  }
}

// Runs after `authenticate` on the webhook-source management routes —
// attaches a client that can only ever see rows belonging to
// req.auth.tenantId. NOT used by the inbound normalize receiver, which
// resolves its tenant from the URL token instead (see
// services/webhookSource.service.ts's lookupByToken — a deliberately
// global, non-tenant-scoped lookup, since the tenant isn't known yet).
export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  req.db = forTenant(prisma, req.auth!.tenantId, TENANT_SCOPED_MODELS);
  next();
}
