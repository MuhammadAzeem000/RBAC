import { Request, Response } from "express";
import { z } from "zod";
import { ingestAlertRequestSchema } from "../interfaces/ingestion";
import * as ingestionService from "../services/ingestion.service";
import * as playbookRunService from "../services/playbookRun.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";

export async function ingestAlert(req: Request, res: Response) {
  const result = ingestAlertRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const { incident, alert, deduped } = await ingestionService.ingestAlert(
    req.db,
    req.auth!.tenantId,
    result.data,
    req.auth!.userId,
  );

  if (deduped) {
    res.status(200).json({ incident, alert, deduped: true });
    return;
  }

  await recordTimelineEvent(req.db, req.auth!.tenantId, {
    incidentId: incident.id,
    eventType: "incident_created_from_alert",
    actorUserId: req.auth!.userId,
    summary: `Incident created from ingested ${alert.source} alert "${alert.externalAlertId}"`,
    metadata: { alertId: alert.id.toString() },
  });
  void publishEvent(ROUTING_KEYS.ALERT_ATTACHED, {
    incidentId: incident.id.toString(),
    alertId: alert.id.toString(),
    externalAlertId: alert.externalAlertId,
  });

  // Only reached for a freshly-created incident (deduped requests return
  // above) — a bad/unknown playbookKey here must not undo the successful
  // ingestion, so it's reported alongside the response, not thrown as a
  // request failure the case itself had nothing to do with.
  let playbookRun: Awaited<ReturnType<typeof playbookRunService.startPlaybookRun>> | undefined;
  let playbookError: string | undefined;

  if (result.data.triggerPlaybookKey) {
    try {
      playbookRun = await playbookRunService.startPlaybookRun(
        req.db,
        req.auth!.tenantId,
        incident.id,
        { playbookKey: result.data.triggerPlaybookKey },
        req.auth!.userId,
      );

      await recordTimelineEvent(req.db, req.auth!.tenantId, {
        incidentId: incident.id,
        eventType: "playbook_started",
        actorUserId: req.auth!.userId,
        summary:
          playbookRun.state === "pending_approval"
            ? `Playbook "${playbookRun.playbookKey}" started, awaiting approval`
            : `Playbook "${playbookRun.playbookKey}" started`,
        metadata: { runId: playbookRun.id.toString(), state: playbookRun.state },
      });
      void publishEvent(ROUTING_KEYS.PLAYBOOK_STARTED, {
        incidentId: incident.id.toString(),
        runId: playbookRun.id.toString(),
        playbookKey: playbookRun.playbookKey,
        state: playbookRun.state,
      });
    } catch (error) {
      playbookError = error instanceof Error ? error.message : String(error);
    }
  }

  res.status(201).json({ incident, alert, deduped: false, playbookRun, playbookError });
}
