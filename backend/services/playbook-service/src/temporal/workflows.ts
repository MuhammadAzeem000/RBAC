// Runs inside Temporal's deterministic, sandboxed V8 isolate — no Node
// built-ins, no I/O, no imports of anything that touches Prisma/HTTP/etc.
// directly (that's activities.ts's job, invoked here only through the
// proxy below). This file is loaded by the worker via a file path
// (worker.ts's workflowsPath), never through a normal Node `import` —
// nothing outside src/temporal/ should import it directly either, for the
// same reason client.ts doesn't (see types.ts's comment).
import { CancellationScope, isCancellation, condition, proxyActivities, setHandler } from "@temporalio/workflow";
import type { PlaybookStep } from "@responderx/shared";
import type * as activities from "./activities";
import { advanceFrontier, buildGraph } from "./graph";
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
type PendingApprovals = Map<string, (signal: DecisionSignalInput) => void>;

// One reusable approval gate — the playbook-start gate and any individual
// step's gate both go through this. Opens an Approval row under the named
// Policy, waits for a decision via signal, escalates once (best-effort, via
// Slack) if the policy's escalationAfter elapses first, then finally
// expires if the full timeoutDuration elapses with no decision.
//
// Branching means more than one gate can be open at once (two parallel
// branches each carrying their own policyKey step) — so, unlike before,
// this does NOT bind its own setHandler(decisionSignal, ...). Instead it
// registers a resolver in the workflow-wide `pendingApprovals` map, keyed
// by this gate's own approvalId; playbookRunWorkflow's single top-level
// signal handler dispatches each incoming signal to the matching resolver.
async function awaitApproval(
  pendingApprovals: PendingApprovals,
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

  pendingApprovals.set(gate.approvalId, (signal) => {
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

  // This gate is done either way — stop listening for it so a stray/late
  // signal (e.g. a duplicate decide call) can't resolve it twice.
  pendingApprovals.delete(gate.approvalId);

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

type NodeOutcome =
  | { status: "succeeded"; output: Record<string, unknown> }
  | { status: "not-approved"; message: string };

// Runs exactly one graph node: its optional policyKey gate, then the step
// itself. Throws only for a genuine step-execution failure (already
// recorded via recordStepResult first) — an unapproved/expired gate is
// reported as a normal NodeOutcome instead, so the wave scheduler can wait
// for the rest of its concurrent siblings to settle (Promise.allSettled)
// before deciding the whole run failed, rather than racing ahead of them.
async function executeNode(
  pendingApprovals: PendingApprovals,
  node: PlaybookStep,
  input: PlaybookRunWorkflowInput,
): Promise<NodeOutcome> {
  if (node.policyKey) {
    const outcome = await awaitApproval(
      pendingApprovals,
      input.runId,
      input.tenantId,
      input.incidentId,
      input.requestorId,
      node.policyKey,
      node.key,
    );
    if (outcome !== "approved") {
      return { status: "not-approved", message: describeApprovalOutcome(outcome, node.key) };
    }
  }

  const stepExecutionId = await recordStepStart(input.runId, input.tenantId, input.incidentId, node);
  try {
    const output = await runStep(node, input.tenantId);
    await recordStepResult(stepExecutionId, input.tenantId, { output });
    return { status: "succeeded", output };
  } catch (error) {
    await recordStepResult(stepExecutionId, input.tenantId, { error: describeError(error) });
    throw error;
  }
}

export async function playbookRunWorkflow(input: PlaybookRunWorkflowInput): Promise<void> {
  // One shared signal channel for the whole run, dispatched by approvalId to
  // whichever gate(s) are currently open — see awaitApproval's comment.
  const pendingApprovals: PendingApprovals = new Map();
  setHandler(decisionSignal, (signal: DecisionSignalInput) => {
    pendingApprovals.get(signal.approvalId)?.(signal);
  });

  try {
    if (input.startPolicyKey) {
      const outcome = await awaitApproval(
        pendingApprovals,
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
    const graph = buildGraph(steps, input.edges);
    const context: Record<string, unknown> = {};
    const resolved = new Set<string>();
    const executed = new Set<string>();
    let frontier = [graph.startKey];

    while (frontier.length > 0) {
      // allSettled, not all — a rejection from one node in this wave must
      // not leave its concurrent siblings' activities orphaned mid-flight;
      // every node in the wave finishes before the run is judged to have
      // failed (see workflows.ts's design notes / the branching plan).
      const settled = await Promise.allSettled(
        frontier.map((key) => executeNode(pendingApprovals, graph.nodes.get(key)!, input)),
      );

      let failureMessage: string | null = null;
      settled.forEach((result, index) => {
        const key = frontier[index]!;
        resolved.add(key);
        if (result.status === "rejected") {
          failureMessage ??= describeError(result.reason);
          return;
        }
        if (result.value.status === "succeeded") {
          executed.add(key);
          context[key] = result.value.output;
        } else {
          failureMessage ??= result.value.message;
        }
      });

      if (failureMessage) {
        await markFailed(input.runId, input.tenantId, input.incidentId, failureMessage);
        return;
      }

      frontier = advanceFrontier(graph, resolved, executed, context);
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
