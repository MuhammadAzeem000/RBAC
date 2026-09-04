import { Request, Response } from "express";
import { z } from "zod";
import { createPlaybookSchema, savePlaybookSchema } from "../interfaces/playbook";
import * as playbookCatalogService from "../services/playbookCatalog.service";
import { HttpError } from "../middlewares/errorHandler";

// req.params values are typed string | string[] by @types/express (to
// account for wildcard/regex route segments) even though a plain named
// segment like ":key" is always a single string at runtime.
function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

export async function listPlaybooks(req: Request, res: Response) {
  const playbooks = await playbookCatalogService.listPlaybooksDetailed(req.db);
  res.json({ data: playbooks });
}

export async function getPlaybook(req: Request, res: Response) {
  const key = routeParam(req.params.key);
  const playbook = await playbookCatalogService.getPlaybookDetail(req.db, key);
  if (!playbook) {
    throw new HttpError(404, `Playbook "${key}" not found`);
  }
  res.json(playbook);
}

export async function createPlaybook(req: Request, res: Response) {
  const result = createPlaybookSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const playbook = await playbookCatalogService.createPlaybook(req.db, req.auth!.tenantId, result.data, req.auth!.userId);
  res.status(201).json(playbook);
}

// Publishes a NEW version of an existing playbook — see
// playbookCatalog.service.ts's publishPlaybookVersion. `key` is read-only
// once created; this route never changes it.
export async function publishPlaybookVersion(req: Request, res: Response) {
  const result = savePlaybookSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const playbook = await playbookCatalogService.publishPlaybookVersion(
    req.db,
    req.auth!.tenantId,
    routeParam(req.params.key),
    result.data,
    req.auth!.userId,
  );
  res.json(playbook);
}
