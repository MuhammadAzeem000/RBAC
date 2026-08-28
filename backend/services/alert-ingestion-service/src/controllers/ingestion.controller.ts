import { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../middlewares/errorHandler";
import { ingestAlertRequestSchema, ingestAlertSystemSchema, listAlertsQuerySchema } from "../interfaces/ingestion";
import { getAlertById, ingestAlert, listAlerts, listAlertsByIncident } from "../services/ingestion.service";
import { parseBigIntId, parseQuery } from "../utils";

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

// Machine-to-machine — normalization-service calls this once it's parsed a
// vendor SIEM/EDR webhook into the canonical shape (see
// middlewares/requireServiceToken.ts). Always the async ingest path (no
// incidentId — a vendor payload never targets an existing incident), so
// this reuses ingestAlert()'s "no incidentId" branch unmodified; `token`
// is passed empty since that branch never reaches the JWT-forwarding
// incident-existence check the attach path needs.
export async function ingestAlertSystemRoute(req: Request, res: Response) {
  const result = ingestAlertSystemSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const { alert, mode } = await ingestAlert(req.db, req.auth!.tenantId, "", result.data, req.auth!.userId);

  if (mode === "deduped") {
    res.status(200).json({ alert, deduped: true });
    return;
  }

  res.status(202).json({ alert, deduped: false });
}

// Two modes, matched by whether ?incidentId is present: the per-incident
// list (AlertsPanel's existing, unpaginated contract) or the tenant-wide
// alert inbox (the standalone Alerts page, paginated).
export async function listAlertsRoute(req: Request, res: Response) {
  if (req.query.incidentId !== undefined) {
    const incidentId = parseBigIntId(req.query.incidentId);
    if (incidentId === null) {
      throw new HttpError(400, "Query param 'incidentId' must be numeric");
    }
    const alerts = await listAlertsByIncident(req.db, incidentId);
    res.json({ data: alerts });
    return;
  }

  const query = parseQuery(listAlertsQuerySchema, req, res);
  if (!query) return;

  const result = await listAlerts(req.db, query);
  res.json(result);
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
