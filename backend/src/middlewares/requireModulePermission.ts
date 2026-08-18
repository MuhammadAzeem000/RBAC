import { NextFunction, Request, Response } from "express";
import * as authzService from "../services/authz.service";

async function run(req: Request, res: Response, next: NextFunction, moduleName: string, actionName: string) {
  const allowed = await authzService.userHasPermission(req.auth!.userId, moduleName, actionName);
  if (!allowed) {
    res.status(403).json({ error: "You don't have permission to perform this action" });
    return;
  }

  next();
}

// Deliberately returns the underlying promise (unlike the asyncHandler route-handler
// wrapper) so this is awaitable in tests, while `.catch(next)` still reports failures
// to Express the normal way.
export function requireModulePermission(moduleName: string, actionName: string) {
  return (req: Request, res: Response, next: NextFunction) =>
    run(req, res, next, moduleName, actionName).catch(next);
}
