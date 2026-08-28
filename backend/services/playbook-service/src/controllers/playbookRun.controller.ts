import { Request, Response } from "express";
import { z } from "zod";
import { startPlaybookRunSchema, startPlaybookRunSystemSchema } from "../interfaces/playbookRun";
import * as playbookRunService from "../services/playbookRun.service";
import * as playbookCatalogService from "../services/playbookCatalog.service";
import { recordIncidentTimelineEvent, verifyIncidentExists } from "../services/incidentClient.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";
import { HttpError } from "../middlewares/errorHandler";
import { parseBigIntId } from "../utils";

export async function listPlaybookCatalog(req: Request, res: Response) {
  const catalog = await playbookCatalogService.getCatalog(req.db);
  res.json({ data: catalog });
}

export async function startPlaybookRun(req: Request, res: Response) {
  const result = startPlaybookRunSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const exists = await verifyIncidentExists(req.auth!.token, result.data.incidentId);
  if (!exists) {
    throw new HttpError(404, `Incident ${result.data.incidentId} not found`);
  }
  const incidentId = BigInt(result.data.incidentId);

  const run = await playbookRunService.startPlaybookRun(req.db, req.auth!.tenantId, incidentId, result.data, req.auth!.userId);

  await recordIncidentTimelineEvent(req.auth!.tenantId.toString(), result.data.incidentId, {
    eventType: "playbook_started",
    actorUserId: req.auth!.userId.toString(),
    summary:
      run.state === "pending_approval"
        ? `Playbook "${run.playbookKey}" started, awaiting approval`
        : `Playbook "${run.playbookKey}" started`,
    metadata: { runId: run.id.toString(), state: run.state },
  });
  void publishEvent(ROUTING_KEYS.PLAYBOOK_STARTED, {
    incidentId: result.data.incidentId,
    runId: run.id.toString(),
    playbookKey: run.playbookKey,
    state: run.state,
  });

  res.status(201).json(run);
}

// Machine-to-machine — incident-service's alert-ingested consumer calls
// this for the async ingest saga's triggerPlaybookKey field, which has no
// user JWT to authenticate a normal startPlaybookRun call with (see
// middlewares/requireServiceToken.ts). Skips verifyIncidentExists: the
// caller just created this exact incident moments earlier in the same
// transaction, so existence is already guaranteed — and there's no JWT to
// forward for that check anyway.
export async function startPlaybookRunSystem(req: Request, res: Response) {
  const result = startPlaybookRunSystemSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const incidentId = BigInt(result.data.incidentId);
  const requestorId = BigInt(result.data.requestorId);

  const run = await playbookRunService.startPlaybookRun(req.db, req.auth!.tenantId, incidentId, result.data, requestorId);

  await recordIncidentTimelineEvent(result.data.tenantId, result.data.incidentId, {
    eventType: "playbook_started",
    actorUserId: result.data.requestorId,
    summary:
      run.state === "pending_approval"
        ? `Playbook "${run.playbookKey}" started, awaiting approval`
        : `Playbook "${run.playbookKey}" started`,
    metadata: { runId: run.id.toString(), state: run.state },
  });
  void publishEvent(ROUTING_KEYS.PLAYBOOK_STARTED, {
    incidentId: result.data.incidentId,
    runId: run.id.toString(),
    playbookKey: run.playbookKey,
    state: run.state,
  });

  res.status(201).json(run);
}

export async function cancelPlaybookRun(req: Request, res: Response) {
  const runId = parseBigIntId(req.params.id);
  if (runId === null) {
    throw new HttpError(400, "Invalid playbook run id");
  }

  const run = await playbookRunService.cancelPlaybookRun(req.db, runId);

  await recordIncidentTimelineEvent(req.auth!.tenantId.toString(), run.incidentId.toString(), {
    eventType: "playbook_cancel_requested",
    actorUserId: req.auth!.userId.toString(),
    summary: `Playbook "${run.playbookKey}" run cancellation requested`,
    metadata: { runId: run.id.toString() },
  });

  res.json(run);
}

export async function listPlaybookRuns(req: Request, res: Response) {
  const incidentId = parseBigIntId(req.query.incidentId);
  if (incidentId === null) {
    throw new HttpError(400, "Query param 'incidentId' is required and must be numeric");
  }

  const runs = await playbookRunService.listPlaybookRuns(req.db, incidentId);
  res.json({ data: runs });
}

export async function getPlaybookRun(req: Request, res: Response) {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    throw new HttpError(400, "Invalid playbook run id");
  }

  const run = await playbookRunService.getPlaybookRunById(req.db, id);
  if (!run) {
    throw new HttpError(404, "Playbook run not found");
  }

  res.json(run);
}
