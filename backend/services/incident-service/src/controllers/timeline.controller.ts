import { Request, Response } from "express";
import { z } from "zod";
import * as timelineService from "../services/timeline.service";
import * as incidentService from "../services/incident.service";
import { paginationQuerySchema } from "../interfaces/pagination";
import { recordTimelineEventSchema } from "../interfaces/timeline";
import { parseBigIntId, parseQuery } from "../utils";

// Machine-to-machine — playbook-service's Temporal Activities call this to
// report timeline entries for playbook/approval state changes, since
// TimelineEvent stays owned by incident-service (it's the incident's whole
// audit/UX trail, not just a playbook concern). Gated by requireServiceToken,
// registered in server.ts BEFORE the authenticate-gated incidentRouter mount.
export async function recordTimelineEventRoute(req: Request, res: Response) {
  const incidentId = parseBigIntId(req.params.id);
  if (incidentId === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return;
  }

  const result = recordTimelineEventSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  await incidentService.assertIncidentExists(req.db, incidentId);
  const entry = await timelineService.recordTimelineEvent(req.db, req.auth!.tenantId, {
    incidentId,
    eventType: result.data.eventType,
    actorUserId: result.data.actorUserId ? BigInt(result.data.actorUserId) : undefined,
    summary: result.data.summary,
    metadata: result.data.metadata,
  });

  res.status(201).json(entry);
}

export async function getTimeline(req: Request, res: Response) {
  const incidentId = parseBigIntId(req.params.id);
  if (incidentId === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return;
  }

  const query = parseQuery(paginationQuerySchema, req, res);
  if (!query) return;

  await incidentService.assertIncidentExists(req.db, incidentId);
  const result = await timelineService.getTimeline(req.db, incidentId, query);
  res.json(result);
}
