import { Request, Response } from "express";
import { z } from "zod";
import { addEvidenceSchema } from "../interfaces/evidence";
import * as evidenceService from "../services/evidence.service";
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

export async function addEvidence(req: Request, res: Response) {
  const incidentId = parseIncidentId(req, res);
  if (incidentId === null) return;

  const result = addEvidenceSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  await incidentService.assertIncidentExists(incidentId);
  const evidence = await evidenceService.addEvidence(incidentId, result.data, req.auth!.userId);

  await recordTimelineEvent({
    incidentId,
    eventType: "evidence_added",
    actorUserId: req.auth!.userId,
    summary: `Evidence added: "${evidence.filename}"`,
    metadata: { evidenceId: evidence.id.toString() },
  });
  void publishEvent(ROUTING_KEYS.EVIDENCE_ADDED, {
    incidentId: incidentId.toString(),
    evidenceId: evidence.id.toString(),
  });

  res.status(201).json(evidence);
}

export async function listEvidence(req: Request, res: Response) {
  const incidentId = parseIncidentId(req, res);
  if (incidentId === null) return;

  await incidentService.assertIncidentExists(incidentId);
  const evidence = await evidenceService.listEvidence(incidentId);
  res.json({ data: evidence });
}
