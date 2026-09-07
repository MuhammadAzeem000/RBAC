import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

// Guards GET /iocs/lookup — the one route called machine-to-machine, from a
// future integration-service connector action or normalization-service
// enrichment step, which has no user JWT to forward (unlike every other
// route in this service, gated by authenticate.ts instead). A shared secret
// plus an explicit tenantId in the query stands in for a real user token
// here — identical pattern to integration-service's requireServiceToken.ts.
//
// req.auth is populated with placeholder identity fields so the downstream
// tenantContext middleware (which reads req.auth.tenantId) works unmodified
// for this route too — userId/email/token are never actually consulted for
// a service-token request, only tenantId is.
export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-service-token"];
  if (header !== env.THREAT_INTELLIGENCE_SERVICE_TOKEN) {
    res.status(401).json({ error: "Missing or invalid service token" });
    return;
  }

  const tenantId = req.query?.tenantId ?? req.body?.tenantId;
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
