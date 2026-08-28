import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

// Guards POST /api/v1/alerts/system — the one route called
// machine-to-machine, from normalization-service, which has no user JWT to
// forward (a vendor SIEM/EDR webhook carries no ResponderX identity). A
// shared secret plus an explicit tenantId in the body stands in for a real
// user token here — same pattern as every other M2M route in this project
// (integration-service's original requireServiceToken.ts, incident-service's
// and playbook-service's copies from the prior slice).
//
// req.auth is populated with placeholder identity fields so the downstream
// tenantContext middleware (which reads req.auth.tenantId) works unmodified
// for this route too — userId/email/token are never actually consulted for
// a service-token request, only tenantId is. The Alert's attachedBy column
// ends up as this placeholder userId (0n) for system-originated alerts,
// same "no human actor" convention used elsewhere in this codebase.
export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-service-token"];
  if (header !== env.ALERT_INGESTION_SERVICE_TOKEN) {
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
