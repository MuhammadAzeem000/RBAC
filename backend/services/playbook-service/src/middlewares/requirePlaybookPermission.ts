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

  const playbooksModule = permissions.find((p) => p.name === MODULE_NAMES.PLAYBOOKS);
  if (!playbooksModule?.actions.includes(actionName)) {
    res.status(403).json({ error: "You don't have permission to perform this action" });
    return;
  }

  next();
}

// Mirrors requireIncidentPermission/requireApprovalPermission — same
// pattern, different module. Gates the Playbook Designer's authoring API
// (routes/playbook.routes.ts, routes/policy.routes.ts) — distinct from
// running a playbook, which stays gated on Incidents:*.
export function requirePlaybookPermission(actionName: string) {
  return (req: Request, res: Response, next: NextFunction) => run(req, res, next, actionName).catch(next);
}
