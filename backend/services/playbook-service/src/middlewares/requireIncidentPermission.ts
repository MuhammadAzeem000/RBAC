import { NextFunction, Request, Response } from "express";
import { MODULE_NAMES } from "../constants/module";
import { fetchMyPermissions } from "../services/identityClient.service";

async function run(req: Request, res: Response, next: NextFunction, actionName: string) {
  let permissions;
  try {
    permissions = await fetchMyPermissions(req.auth!.token);
  } catch {
    // identity-service unreachable — fail closed, this is a security check.
    res.status(503).json({ error: "Permission service unavailable" });
    return;
  }

  if (!permissions) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const incidentsModule = permissions.find((p) => p.name === MODULE_NAMES.INCIDENTS);
  if (!incidentsModule?.actions.includes(actionName)) {
    res.status(403).json({ error: "You don't have permission to perform this action" });
    return;
  }

  next();
}

// Mirrors incident-service's own requireIncidentPermission.ts exactly —
// same module contract, checked from a different service. Playbook
// catalog/runs are gated on Incidents:* since starting/viewing a run is,
// mechanically, an incident-response action.
export function requireIncidentPermission(actionName: string) {
  return (req: Request, res: Response, next: NextFunction) => run(req, res, next, actionName).catch(next);
}
