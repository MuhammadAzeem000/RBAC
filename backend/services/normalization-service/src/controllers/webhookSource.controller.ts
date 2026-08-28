import { Request, Response } from "express";
import { z } from "zod";
import { createWebhookSourceSchema } from "../interfaces/webhookSource";
import * as webhookSourceService from "../services/webhookSource.service";

// The token is returned on both create and list — there's no separate
// frontend UI this slice to show it "only once" the way a real secrets UI
// would, so the API is the only place to retrieve it (see the Phase 5.3
// plan's "explicitly not in this pass").
export async function createWebhookSourceRoute(req: Request, res: Response) {
  const result = createWebhookSourceSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const source = await webhookSourceService.createWebhookSource(req.db, req.auth!.tenantId, result.data, req.auth!.userId);
  res.status(201).json({ ...source, receivePath: `/api/v1/normalize/${source.vendor}/${source.token}` });
}

export async function listWebhookSourcesRoute(req: Request, res: Response) {
  const sources = await webhookSourceService.listWebhookSources(req.db);
  res.json({
    data: sources.map((source) => ({ ...source, receivePath: `/api/v1/normalize/${source.vendor}/${source.token}` })),
  });
}
