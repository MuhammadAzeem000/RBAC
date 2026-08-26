// Runs inside Temporal's deterministic, sandboxed V8 isolate — no Node
// built-ins, no I/O, no imports of anything that touches Prisma/HTTP/etc.
// directly (that's activities.ts's job, invoked here only through the
// proxy below). This file is loaded by the worker via a file path
// (worker.ts's workflowsPath), never through a normal Node `import` —
// nothing outside src/temporal/ should import it directly either, for the
// same reason client.ts doesn't (see types.ts's comment).
import { CancellationScope, condition, isCancellation, proxyActivities, setHandler } from "@temporalio/workflow";
import type { Duration } from "@temporalio/common";
import type * as activities from "./activities";
import { ApprovalSignalInput, PlaybookRunWorkflowInput, approveSignal } from "./types";

export type { ApprovalSignalInput, PlaybookRunWorkflowInput };

const {
  markRunning,
  recordApproval,
  recordStepStart,
  recordStepResult,
  runSimulatedStep,
  markSucceeded,
  markFailed,
  markCancelled,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 3, backoffCoefficient: 2 },
});

const SYNTHETIC_STEP = { key: "simulated-completion", name: "Run playbook", config: {} };

export async function playbookRunWorkflow(input: PlaybookRunWorkflowInput): Promise<void> {
  let approved = !input.requiresApproval;
  let approverId: string | null = null;

  setHandler(approveSignal, (signal) => {
    approved = true;
    approverId = signal.approverId;
  });

  try {
    if (input.requiresApproval) {
      // Cast: approvalTimeout is a validated-at-config-load string (see
      // config/env.ts), not something statically known to match the "ms"
      // library's Duration string format — trusted at runtime, same as
      // other operationally-validated-not-statically-provable casts
      // elsewhere in this codebase.
      const approvedInTime = await condition(() => approved, input.approvalTimeout as Duration);
      if (!approvedInTime) {
        await markFailed(input.runId, input.tenantId, input.incidentId, "Approval expired");
        return;
      }
      await recordApproval(input.runId, input.tenantId, approverId!);
    }

    await markRunning(input.runId, input.tenantId);

    const steps = input.steps.length > 0 ? input.steps : [SYNTHETIC_STEP];
    for (const step of steps) {
      const stepExecutionId = await recordStepStart(input.runId, input.tenantId, input.incidentId, step);
      try {
        const output = await runSimulatedStep(step);
        await recordStepResult(stepExecutionId, input.tenantId, { output });
      } catch (error) {
        await recordStepResult(stepExecutionId, input.tenantId, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    await markSucceeded(
      input.runId,
      input.tenantId,
      input.incidentId,
      `${input.playbookName} completed successfully (simulated).`,
    );
  } catch (error) {
    if (isCancellation(error)) {
      // A cancellation request also cancels any activity already in flight
      // and would cancel a fresh call too — this cleanup call has to run in
      // a non-cancellable scope to actually complete.
      await CancellationScope.nonCancellable(() => markCancelled(input.runId, input.tenantId, input.incidentId));
      throw error; // re-throw so Temporal itself records this execution as Cancelled, not Completed
    }
    await markFailed(
      input.runId,
      input.tenantId,
      input.incidentId,
      error instanceof Error ? error.message : String(error),
    );
  }
}
