import { Request, Response } from "express";
import * as timelineService from "../services/timeline.service";
import * as incidentService from "../services/incident.service";
import { paginationQuerySchema } from "../interfaces/pagination";
import { parseBigIntId, parseQuery } from "../utils";

export async function getTimeline(req: Request, res: Response) {
  const incidentId = parseBigIntId(req.params.id);
  if (incidentId === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return;
  }

  const query = parseQuery(paginationQuerySchema, req, res);
  if (!query) return;

  await incidentService.assertIncidentExists(incidentId);
  const result = await timelineService.getTimeline(incidentId, query);
  res.json(result);
}
