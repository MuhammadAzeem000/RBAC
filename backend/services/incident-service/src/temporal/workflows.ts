// Runs inside Temporal's deterministic, sandboxed V8 isolate — no Node
// built-ins, no I/O, no imports of anything that touches Prisma/HTTP/etc.
// directly (that's activities.ts's job, invoked here only through the
// proxy below). This file is loaded by the worker via a file path
// (worker.ts's workflowsPath), never through a normal Node `import` —
// nothing outside src/temporal/ should import it directly either, for the
// same reason client.ts doesn't (see types.ts's comment).
import { CancellationScope, condition, isCancellation, proxyActivities, setHandler } from "@temporalio/workflow";
import type { PlaybookStep } from "@responderx/shared";
import type * as activities from "./activities";
import { DecisionSignalInput, PlaybookRunWorkflowInput, decisionSignal, parseDurationToMs } from "./types";

export type { DecisionSignalInput, PlaybookRunWorkflowInput };

const {
  markRunning,
  createApproval,
  recordDecision,
  expireApproval,
  escalateApproval,
  recordStepStart,
  recordStepResult,
  runStep,
  markSucceeded,
  markFailed,
  markCancelled,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 3, backoffCoefficient: 2 },
});

const SYNTHETIC_STEP: PlaybookStep = { key: "simulated-completion", name: "Run playbook", config: {} };

// Temporal wraps an Activity's thrown error in an ActivityFailure whose own
// .message is a generic "Activity task failed" — the real message (e.g. a
// connector's actual error text) lives on .cause, possibly nested more than
// one level deep. Walks to the deepest cause so markFailed/recordStepResult
// record something an operator can actually act on, not a generic wrapper.
function describeError(error: unknown): string {
  let current: Error | undefined = error instanceof Error ? error : undefined;
  let message = current?.message ?? String(error);
  while (current?.cause instanceof Error) {
    current = current.cause;
    message = current.message;
  }
  return message;
}

type ApprovalOutcome = "approved" | "rejected" | "expired";

// One reusable approval gate — the playbook-start gate and any individual
// step's gate both go through this (Phase 4: "approval as a first-class
// step type", not a one-off inline block). Opens an Approval row under the
// named Policy, waits for a decision via signal, escalates once
// (best-effort, via Slack) if the policy's escalationAfter elapses first,
// then finally expires if the full timeoutDuration elapses with no decision.
async function awaitApproval(
  runId: string,
  tenantId: string,
  incidentId: string,
  requestorId: string,
  policyKey: string,
  stepKey: string | null,
): Promise<ApprovalOutcome> {
  const gate = await createApproval(runId, tenantId, incidentId, requestorId, policyKey, stepKey);

  let decided = false;
  let decision: "approved" | "rejected" | null = null;
  let approverId: string | null = null;

  setHandler(decisionSignal, (signal: DecisionSignalInput) => {
    decided = true;
    decision = signal.decision;
    approverId = signal.approverId;
  });

  const totalMs = parseDurationToMs(gate.timeoutDuration);
  let timedOut: boolean;

  if (gate.escalationAfter) {
    const escalateMs = parseDurationToMs(gate.escalationAfter);
    const decidedBeforeEscalation = await condition(() => decided, escalateMs);
    if (decidedBeforeEscalation) {
      timedOut = false;
    } else {
      if (gate.escalationChannel) {
        await escalateApproval(gate.approvalId, tenantId, policyKey, stepKey, gate.escalationChannel);
      }
      timedOut = !(await condition(() => decided, Math.max(totalMs - escalateMs, 0)));
    }
  } else {
    timedOut = !(await condition(() => decided, totalMs));
  }

  // Only this invocation's own decision should ever be delivered to it —
  // clearing the handler here (rather than leaving it bound) is what makes
  // it safe to call awaitApproval again later in the same run for a
  // different gate without a stray/late signal answering the wrong one.
  setHandler(decisionSignal, undefined);

  if (timedOut) {
    await expireApproval(gate.approvalId, tenantId, incidentId);
    return "expired";
  }

  await recordDecision(gate.approvalId, tenantId, incidentId, decision!, approverId!);
  return decision!;
}

function describeApprovalOutcome(outcome: "rejected" | "expired", stepKey: string | null): string {
  const where = stepKey ? `step "${stepKey}"` : "playbook start";
  return outcome === "rejected" ? `Approval for ${where} was rejected` : `Approval for ${where} expired`;
}

export async function playbookRunWorkflow(input: PlaybookRunWorkflowInput): Promise<void> {
  try {
    if (input.startPolicyKey) {
      const outcome = await awaitApproval(
        input.runId,
        input.tenantId,
        input.incidentId,
        input.requestorId,
        input.startPolicyKey,
        null,
      );
      if (outcome !== "approved") {
        await markFailed(input.runId, input.tenantId, input.incidentId, describeApprovalOutcome(outcome, null));
        return;
      }
    }

    await markRunning(input.runId, input.tenantId);

    const steps = input.steps.length > 0 ? input.steps : [SYNTHETIC_STEP];
    for (const step of steps) {
      if (step.policyKey) {
        const outcome = await awaitApproval(
          input.runId,
          input.tenantId,
          input.incidentId,
          input.requestorId,
          step.policyKey,
          step.key,
        );
        if (outcome !== "approved") {
          await markFailed(input.runId, input.tenantId, input.incidentId, describeApprovalOutcome(outcome, step.key));
          return;
        }
      }

      const stepExecutionId = await recordStepStart(input.runId, input.tenantId, input.incidentId, step);
      try {
        const output = await runStep(step, input.tenantId);
        await recordStepResult(stepExecutionId, input.tenantId, { output });
      } catch (error) {
        await recordStepResult(stepExecutionId, input.tenantId, { error: describeError(error) });
        throw error;
      }
    }

    await markSucceeded(input.runId, input.tenantId, input.incidentId, `${input.playbookName} completed successfully.`);
  } catch (error) {
    if (isCancellation(error)) {
      // A cancellation request also cancels any activity already in flight
      // and would cancel a fresh call too — this cleanup call has to run in
      // a non-cancellable scope to actually complete.
      await CancellationScope.nonCancellable(() => markCancelled(input.runId, input.tenantId, input.incidentId));
      throw error; // re-throw so Temporal itself records this execution as Cancelled, not Completed
    }
    await markFailed(input.runId, input.tenantId, input.incidentId, describeError(error));
  }
}
