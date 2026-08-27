import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

// Guards POST /connectors/:key/actions/:action — the one route called
// machine-to-machine, from incident-service's Temporal Activity, which runs
// outside any HTTP request and so has no user JWT to forward (unlike every
// other route in this service, gated by authenticate.ts instead). A shared
// secret plus an explicit tenantId in the body (the Activity already has it
// from the workflow input — see incident-service's temporal/types.ts)
// stands in for a real user token here.
//
// req.auth is populated with placeholder identity fields so the downstream
// tenantContext middleware (which reads req.auth.tenantId) works unmodified
// for this route too — userId/email/token are never actually consulted for
// a service-token request, only tenantId is.
export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-service-token"];
  if (header !== env.INTEGRATION_SERVICE_TOKEN) {
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
