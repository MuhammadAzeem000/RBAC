import { Request, Response } from "express";
import * as iocLookupService from "../services/iocLookup.service";

function routeParam(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// The primary future-connector/enrichment seam — see requireServiceToken.ts
// and iocLookup.service.ts. Mounted both behind the service-token route
// (pre-auth, for machine-to-machine callers) and the human-facing router.
export async function lookupIoc(req: Request, res: Response) {
  const value = routeParam(req.query.value);
  if (!value) {
    res.status(400).json({ error: "value is required" });
    return;
  }

  const iocType = routeParam(req.query.type);
  const result = await iocLookupService.lookupIoc(req.db, value, iocType);
  res.json({ data: result });
}

export async function searchIocs(req: Request, res: Response) {
  const results = await iocLookupService.searchIocs(req.db, {
    value: routeParam(req.query.value),
    iocType: routeParam(req.query.type),
    stixType: routeParam(req.query.stixType),
  });
  res.json({ data: results });
}
