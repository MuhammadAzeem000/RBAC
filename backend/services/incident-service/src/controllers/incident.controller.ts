import { Request, Response } from "express";
import { z } from "zod";
import { createIncidentSchema, listIncidentsQuerySchema, updateIncidentSchema } from "../interfaces/incident";
import * as incidentService from "../services/incident.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return null;
  }
  return id;
}

export async function createIncident(req: Request, res: Response) {
  const result = createIncidentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const incident = await incidentService.createIncident(result.data, req.auth!.userId);

  await recordTimelineEvent({
    incidentId: incident.id,
    eventType: "created",
    actorUserId: req.auth!.userId,
    summary: `Incident created: "${incident.title}"`,
  });
  void publishEvent(ROUTING_KEYS.CREATED, {
    incidentId: incident.id.toString(),
    title: incident.title,
    severity: incident.severity,
    createdBy: incident.createdBy.toString(),
  });

  res.status(201).json(incident);
}

export async function listIncidents(req: Request, res: Response) {
  const query = parseQuery(listIncidentsQuerySchema, req, res);
  if (!query) return;

  const result = await incidentService.listIncidents(query);
  res.json(result);
}

export async function getIncidentById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const incident = await incidentService.getIncidentById(id);
  if (!incident) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  res.json(incident);
}

const CHANGE_ROUTING_KEY: Record<string, string> = {
  status_changed: ROUTING_KEYS.STATUS_CHANGED,
  severity_changed: ROUTING_KEYS.SEVERITY_CHANGED,
  assigned: ROUTING_KEYS.ASSIGNED,
  updated: ROUTING_KEYS.UPDATED,
  reopened: ROUTING_KEYS.UPDATED,
};

export async function updateIncident(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updateIncidentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const { incident, changes } = await incidentService.updateIncident(id, result.data, req.auth!.userId);

  for (const change of changes) {
    await recordTimelineEvent({
      incidentId: incident.id,
      eventType: change.type,
      actorUserId: req.auth!.userId,
      summary: change.summary,
      metadata: change.metadata,
    });
    void publishEvent(CHANGE_ROUTING_KEY[change.type], {
      incidentId: incident.id.toString(),
      ...change.metadata,
    });
  }

  const statusChanged = changes.some((c) => c.type === "status_changed");
  if (statusChanged && incident.status === "resolved") {
    void publishEvent(ROUTING_KEYS.RESOLVED, { incidentId: incident.id.toString() });
  }
  if (statusChanged && incident.status === "closed") {
    void publishEvent(ROUTING_KEYS.CLOSED, { incidentId: incident.id.toString() });
  }

  res.json(incident);
}

export async function deleteIncident(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  await incidentService.deleteIncident(id);
  res.status(204).send();
}
