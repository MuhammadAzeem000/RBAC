import { Request, Response } from "express";
import { z } from "zod";
import { attachAlertSchema } from "../interfaces/alert";
import * as alertService from "../services/alert.service";
import * as incidentService from "../services/incident.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";
import { parseBigIntId } from "../utils";

function parseIncidentId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return null;
  }
  return id;
}

export async function attachAlert(req: Request, res: Response) {
  const incidentId = parseIncidentId(req, res);
  if (incidentId === null) return;

  const result = attachAlertSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  await incidentService.assertIncidentExists(incidentId);
  const alert = await alertService.attachAlert(incidentId, result.data, req.auth!.userId);

  await recordTimelineEvent({
    incidentId,
    eventType: "alert_attached",
    actorUserId: req.auth!.userId,
    summary: `Alert "${alert.externalAlertId}" attached from ${alert.source}`,
    metadata: { alertId: alert.id.toString() },
  });
  void publishEvent(ROUTING_KEYS.ALERT_ATTACHED, {
    incidentId: incidentId.toString(),
    alertId: alert.id.toString(),
    externalAlertId: alert.externalAlertId,
  });

  res.status(201).json(alert);
}

export async function listAlerts(req: Request, res: Response) {
  const incidentId = parseIncidentId(req, res);
  if (incidentId === null) return;

  await incidentService.assertIncidentExists(incidentId);
  const alerts = await alertService.listAlerts(incidentId);
  res.json({ data: alerts });
}
