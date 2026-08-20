import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { findPlaybook } from "../constants/incidents";
import { StartPlaybookRunInput } from "../interfaces/playbookRun";
import { recordTimelineEvent } from "./timeline.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";

const SIMULATED_RUN_DURATION_MS = 4000;

export interface PlaybookRunResponse {
  id: bigint;
  incidentId: bigint;
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
  incidentId: bigint,
  input: StartPlaybookRunInput,
  actorUserId: bigint,
): Promise<PlaybookRunResponse> {
  const playbook = findPlaybook(input.playbookKey);
  if (!playbook) {
    throw new HttpError(400, `Unknown playbook "${input.playbookKey}"`);
  }

  const run = await prisma.playbookRun.create({
    data: {
      incidentId,
      playbookKey: playbook.key,
      initiatedBy: actorUserId,
      requiresApproval: playbook.requiresApproval,
      state: playbook.requiresApproval ? "pending_approval" : "running",
      startedAt: playbook.requiresApproval ? undefined : new Date(),
      inputs: input.inputs as Prisma.InputJsonValue | undefined,
    },
    select: playbookRunSelect,
  });

  if (!playbook.requiresApproval) {
    scheduleSimulatedCompletion(run.id, incidentId, playbook.name);
  }

  return run;
}

export async function approvePlaybookRun(
  incidentId: bigint,
  runId: bigint,
  actorUserId: bigint,
): Promise<PlaybookRunResponse> {
  const existing = await prisma.playbookRun.findFirst({ where: { id: runId, incidentId } });
  if (!existing) {
    throw new HttpError(404, "Playbook run not found");
  }
  if (existing.state !== "pending_approval") {
    throw new HttpError(400, `Run is "${existing.state}", not awaiting approval`);
  }

  const run = await prisma.playbookRun.update({
    where: { id: runId },
    data: { state: "running", approvedBy: actorUserId, approvedAt: new Date(), startedAt: new Date() },
    select: playbookRunSelect,
  });

  const playbook = findPlaybook(run.playbookKey);
  scheduleSimulatedCompletion(run.id, incidentId, playbook?.name ?? run.playbookKey);

  return run;
}

export function listPlaybookRuns(incidentId: bigint): Promise<PlaybookRunResponse[]> {
  return prisma.playbookRun.findMany({
    where: { incidentId },
    select: playbookRunSelect,
    orderBy: { createdAt: "desc" },
  });
}

// No real SOAR automation engine exists in this codebase (see
// schema.prisma's PlaybookRun comment) — this deterministically completes a
// run a few seconds after it starts, recording the timeline event and
// publishing incident.playbook_completed itself, since there is no HTTP
// request/controller context left by the time the timer fires.
function scheduleSimulatedCompletion(runId: bigint, incidentId: bigint, playbookName: string): void {
  setTimeout(() => {
    void (async () => {
      try {
        const run = await prisma.playbookRun.update({
          where: { id: runId },
          data: {
            state: "succeeded",
            endedAt: new Date(),
            outputsSummary: `${playbookName} completed successfully (simulated).`,
          },
          select: playbookRunSelect,
        });

        await recordTimelineEvent({
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
