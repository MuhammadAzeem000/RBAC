import { Request, Response } from "express";
import { z } from "zod";
import { startPlaybookRunSchema } from "../interfaces/playbookRun";
import * as playbookRunService from "../services/playbookRun.service";
import * as incidentService from "../services/incident.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";
import { PLAYBOOK_CATALOG } from "../constants/incidents";
import { parseBigIntId } from "../utils";

function parseIds(req: Request, res: Response): { incidentId: bigint; runId?: bigint } | null {
  const incidentId = parseBigIntId(req.params.id);
  if (incidentId === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return null;
  }
  if (req.params.runId === undefined) return { incidentId };

  const runId = parseBigIntId(req.params.runId);
  if (runId === null) {
    res.status(400).json({ error: "Invalid playbook run id" });
    return null;
  }
  return { incidentId, runId };
}

export function listPlaybookCatalog(_req: Request, res: Response) {
  res.json({ data: PLAYBOOK_CATALOG });
}

export async function startPlaybookRun(req: Request, res: Response) {
  const ids = parseIds(req, res);
  if (!ids) return;

  const result = startPlaybookRunSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  await incidentService.assertIncidentExists(ids.incidentId);
  const run = await playbookRunService.startPlaybookRun(ids.incidentId, result.data, req.auth!.userId);

  await recordTimelineEvent({
    incidentId: ids.incidentId,
    eventType: "playbook_started",
    actorUserId: req.auth!.userId,
    summary:
      run.state === "pending_approval"
        ? `Playbook "${run.playbookKey}" started, awaiting approval`
        : `Playbook "${run.playbookKey}" started`,
    metadata: { runId: run.id.toString(), state: run.state },
  });
  void publishEvent(ROUTING_KEYS.PLAYBOOK_STARTED, {
    incidentId: ids.incidentId.toString(),
    runId: run.id.toString(),
    playbookKey: run.playbookKey,
    state: run.state,
  });

  res.status(201).json(run);
}

export async function approvePlaybookRun(req: Request, res: Response) {
  const ids = parseIds(req, res);
  if (!ids || ids.runId === undefined) {
    if (ids) res.status(400).json({ error: "Playbook run id is required" });
    return;
  }

  await incidentService.assertIncidentExists(ids.incidentId);
  const run = await playbookRunService.approvePlaybookRun(ids.incidentId, ids.runId, req.auth!.userId);

  await recordTimelineEvent({
    incidentId: ids.incidentId,
    eventType: "playbook_approved",
    actorUserId: req.auth!.userId,
    summary: `Playbook "${run.playbookKey}" run approved`,
    metadata: { runId: run.id.toString() },
  });

  res.json(run);
}

export async function listPlaybookRuns(req: Request, res: Response) {
  const ids = parseIds(req, res);
  if (!ids) return;

  await incidentService.assertIncidentExists(ids.incidentId);
  const runs = await playbookRunService.listPlaybookRuns(ids.incidentId);
  res.json({ data: runs });
}
