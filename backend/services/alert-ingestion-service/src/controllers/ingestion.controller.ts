import { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../middlewares/errorHandler";
import { ingestAlertRequestSchema } from "../interfaces/ingestion";
import { getAlertById, ingestAlert, listAlertsByIncident } from "../services/ingestion.service";
import { parseBigIntId } from "../utils";

export async function ingestAlertRoute(req: Request, res: Response) {
  const result = ingestAlertRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const { alert, mode } = await ingestAlert(req.db, req.auth!.tenantId, req.auth!.token, result.data, req.auth!.userId);

  if (mode === "deduped") {
    res.status(200).json({ alert, deduped: true });
    return;
  }

  // "attached" resolves synchronously (no saga involved — see
  // ingestion.service.ts); "pending" means the incident-creation saga has
  // only just been handed off via the outbox, so 202 is the honest status —
  // the caller polls GET /:id to see it move to "linked".
  res.status(mode === "attached" ? 201 : 202).json({ alert, deduped: false });
}

export async function listAlertsRoute(req: Request, res: Response) {
  const incidentId = parseBigIntId(req.query.incidentId);
  if (incidentId === null) {
    throw new HttpError(400, "Query param 'incidentId' is required and must be numeric");
  }

  const alerts = await listAlertsByIncident(req.db, incidentId);
  res.json({ data: alerts });
}

export async function getAlertRoute(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    throw new HttpError(400, "Invalid alert id");
  }

  const alert = await getAlertById(req.db, id);
  if (!alert) {
    throw new HttpError(404, "Alert not found");
  }

  res.json({ alert });
}
