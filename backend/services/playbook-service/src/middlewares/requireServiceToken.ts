import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

// Guards POST /api/v1/playbook-runs/system — the one route called
// machine-to-machine, from incident-service's alert-ingested consumer
// (events/alertConsumer.ts's triggerPlaybookKey handling runs outside any
// HTTP request, so has no user JWT to forward). Same pattern as
// incident-service's own requireServiceToken.ts (guarding the M2M call in
// the OTHER direction, for timeline writes) and integration-service's
// original requireServiceToken.ts.
//
// req.auth is populated with placeholder identity fields so the downstream
// tenantContext middleware (which reads req.auth.tenantId) works unmodified
// for this route too — userId/email/token are never actually consulted for
// a service-token request; the real actor (the alert's original requestor)
// travels in the body instead (see startPlaybookRunSystemSchema's requestorId).
export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-service-token"];
  if (header !== env.PLAYBOOK_SERVICE_TOKEN) {
    res.status(401).json({ error: "Missing or invalid service token" });
    return;
  }

  const tenantId = req.body?.tenantId;
  if (typeof tenantId !== "string" || !/^\d+$/.test(tenantId)) {
    res.status(400).json({ error: "tenantId is required" });
    return;
  }

  req.auth = {
    userId: 0n,
    email: "system@internal",
    tenantId: BigInt(tenantId),
    token: "",
  };
  next();
}
