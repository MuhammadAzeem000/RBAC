import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

// Guards POST /api/v1/incidents/:id/timeline — the one route called
// machine-to-machine, from playbook-service's Temporal Activities, which run
// outside any HTTP request and so have no user JWT to forward. A shared
// secret plus an explicit tenantId in the body stands in for a real user
// token here — exact same pattern as integration-service's own
// requireServiceToken.ts (which guards ITS machine route, called from this
// same subsystem before Phase 5.2's split).
//
// req.auth is populated with placeholder identity fields so the downstream
// tenantContext middleware (which reads req.auth.tenantId) works unmodified
// for this route too — userId/email/token are never actually consulted for
// a service-token request, only tenantId is.
export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-service-token"];
  if (header !== env.INCIDENT_SERVICE_TOKEN) {
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
