import { forTenant } from "@responderx/shared";
import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { findLatestVersionByKey, findVersionById } from "./playbookCatalog.service";
import { StartPlaybookRunInput } from "../interfaces/playbookRun";
import { recordTimelineEvent } from "./timeline.service";
import { writeOutboxEvent } from "./outbox.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";

const SIMULATED_RUN_DURATION_MS = 4000;

// Same tenant-scoped models as middlewares/tenantContext.ts — duplicated
// here (not imported) because scheduleSimulatedCompletion() runs from a
// detached setTimeout with no req.db to reuse; it builds its own scoped
// client from the tenantId captured in the closure at schedule time.
const TENANT_SCOPED_MODELS = ["PlaybookRun", "TimelineEvent"] as const;

export interface PlaybookRunResponse {
  id: bigint;
  incidentId: bigint;
  playbookVersionId: bigint;
  playbookKey: string;
  playbookVersion: string;
  state: string;
  requiresApproval: boolean;
  approvedBy: bigint | null;
  approvedAt: Date | null;
  initiatedBy: bigint;
  startedAt: Date | null;
  endedAt: Date | null;
  inputs: unknown;
  outputsSummary: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

const playbookRunSelect = {
  id: true,
  incidentId: true,
  playbookVersionId: true,
  playbookKey: true,
  playbookVersion: true,
  state: true,
  requiresApproval: true,
  approvedBy: true,
  approvedAt: true,
  initiatedBy: true,
  startedAt: true,
  endedAt: true,
  inputs: true,
  outputsSummary: true,
  errorMessage: true,
  createdAt: true,
} as const;

export async function startPlaybookRun(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  incidentId: bigint,
  input: StartPlaybookRunInput,
  actorUserId: bigint,
): Promise<PlaybookRunResponse> {
  const resolved = await findLatestVersionByKey(db, input.playbookKey);
  if (!resolved) {
    throw new HttpError(400, `Unknown playbook "${input.playbookKey}"`);
  }

  const run = await db.playbookRun.create({
    data: {
      // See incident.service.ts::createIncident for why this is passed
      // explicitly even though the tenant-scoping extension overwrites it.
      tenantId,
      incidentId,
      playbookVersionId: resolved.playbookVersionId,
      playbookKey: resolved.playbookKey,
      playbookVersion: resolved.version,
      initiatedBy: actorUserId,
      requiresApproval: resolved.requiresApproval,
      state: resolved.requiresApproval ? "pending_approval" : "running",
      startedAt: resolved.requiresApproval ? undefined : new Date(),
      inputs: input.inputs as Prisma.InputJsonValue | undefined,
    },
    select: playbookRunSelect,
  });

  if (!resolved.requiresApproval) {
    scheduleSimulatedCompletion(tenantId, run.id, incidentId, resolved.playbookName);
  }

  return run;
}

export async function approvePlaybookRun(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  incidentId: bigint,
  runId: bigint,
  actorUserId: bigint,
): Promise<PlaybookRunResponse> {
  const existing = await db.playbookRun.findFirst({ where: { id: runId, incidentId } });
  if (!existing) {
    throw new HttpError(404, "Playbook run not found");
  }
  if (existing.state !== "pending_approval") {
    throw new HttpError(400, `Run is "${existing.state}", not awaiting approval`);
  }

  // Approving a disruptive action is exactly the kind of decision the MVP
  // plan requires be centrally audited (§5, "every approval... must be
  // attributable and queryable") — this was a real gap: the run only ever
  // got a TimelineEvent (this service's own UX feed), never reached
  // audit-service. Now it does, in the same transaction as the state change.
  const run = await db.$transaction(async (tx) => {
    const updated = await tx.playbookRun.update({
      where: { id: runId },
      data: { state: "running", approvedBy: actorUserId, approvedAt: new Date(), startedAt: new Date() },
      select: playbookRunSelect,
    });

    await writeOutboxEvent(tx, {
      tenantId,
      eventType: "PLAYBOOK_RUN_APPROVED",
      aggregateType: "PLAYBOOK_RUN",
      aggregateId: updated.id.toString(),
      actorId: actorUserId.toString(),
      action: "APPROVE",
      resourceType: "PLAYBOOK_RUN",
      resourceId: updated.id.toString(),
      metadata: { incidentId: incidentId.toString(), playbookKey: updated.playbookKey },
    });

    return updated;
  });

  const resolved = await findVersionById(db, run.playbookVersionId);
  scheduleSimulatedCompletion(tenantId, run.id, incidentId, resolved?.playbookName ?? run.playbookKey);

  return run;
}

export function listPlaybookRuns(db: Prisma.TransactionClient, incidentId: bigint): Promise<PlaybookRunResponse[]> {
  return db.playbookRun.findMany({
    where: { incidentId },
    select: playbookRunSelect,
    orderBy: { createdAt: "desc" },
  });
}

// No real SOAR automation engine exists in this codebase (see
// schema.prisma's PlaybookRun comment) — this deterministically completes a
// run a few seconds after it starts, recording the timeline event and
// publishing incident.playbook_completed itself, since there is no HTTP
// request/controller context (and no req.db) left by the time the timer
// fires — it builds its own tenant-scoped client from the tenantId captured
// when the run was started/approved.
function scheduleSimulatedCompletion(tenantId: bigint, runId: bigint, incidentId: bigint, playbookName: string): void {
  setTimeout(() => {
    void (async () => {
      try {
        const db = forTenant(prisma, tenantId, TENANT_SCOPED_MODELS);
        const run = await db.playbookRun.update({
          where: { id: runId },
          data: {
            state: "succeeded",
            endedAt: new Date(),
            outputsSummary: `${playbookName} completed successfully (simulated).`,
          },
          select: playbookRunSelect,
        });

        await recordTimelineEvent(db, tenantId, {
          incidentId,
          eventType: "playbook_completed",
          summary: `Playbook "${playbookName}" completed: ${run.state}`,
          metadata: { runId: runId.toString(), state: run.state },
        });
        void publishEvent(ROUTING_KEYS.PLAYBOOK_COMPLETED, {
          incidentId: incidentId.toString(),
          runId: runId.toString(),
          playbookKey: run.playbookKey,
          state: run.state,
        });
      } catch (error) {
        console.error("Failed to complete simulated playbook run:", error);
      }
    })();
  }, SIMULATED_RUN_DURATION_MS);
}
