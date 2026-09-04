import { defineSignal } from "@temporalio/workflow";
import type { PlaybookEdge, PlaybookStep } from "@responderx/shared";

// Shared between workflows.ts (the workflow implementation — loaded ONLY by
// Temporal's sandboxed worker bundler via a file path, never a normal Node
// import) and client.ts (plain Node code that starts/signals workflows).
// Kept in its own file deliberately: workflows.ts calls proxyActivities() at
// module scope, which throws outside an active workflow execution context —
// client.ts must never import that module directly, only what's defined
// here, which has no such context requirement.
export interface PlaybookRunWorkflowInput {
  runId: string;
  tenantId: string;
  incidentId: string;
  requestorId: string;
  playbookName: string;
  // The Policy (by key) gating this run before its first step — null means
  // no start gate, replacing the old requiresApproval boolean (Phase 4).
  // Individual steps carry their own optional policyKey (PlaybookStep,
  // @responderx/shared) for a mid-run gate instead of/in addition to this.
  startPolicyKey: string | null;
  steps: PlaybookStep[];
  // Empty means "no explicit graph" — workflows.ts's graph.ts synthesizes an
  // implicit linear chain over `steps` in that case (see @responderx/shared's
  // playbookVersionSchema comment).
  edges: PlaybookEdge[];
}

export interface DecisionSignalInput {
  decision: "approved" | "rejected";
  approverId: string;
  // Identifies which approval gate this decision is for. Branching means
  // multiple gates (e.g. one per parallel branch's policyKey step) can be
  // open concurrently within the same run — workflows.ts's playbookRunWorkflow
  // dispatches incoming signals to the matching gate by this id rather than
  // assuming there's only ever one gate open, the way it could when steps
  // ran strictly sequentially.
  approvalId: string;
}

// Generalizes the old approve-only signal to a real decision — a human can
// now explicitly reject, not just approve-or-silently-time-out. One shared
// channel for every approval gate across the whole run; workflows.ts routes
// each incoming signal to the correct concurrently-open gate via
// DecisionSignalInput.approvalId (see its playbookRunWorkflow/awaitApproval).
export const decisionSignal = defineSignal<[DecisionSignalInput]>("decision");

export const PLAYBOOK_TASK_QUEUE = "soar-playbooks";
export const PLAYBOOK_WORKFLOW_TYPE = "playbookRunWorkflow";

// A very small duration-string parser — deliberately not a general "ms"
// library replacement, just enough for the "<number> <unit>" strings this
// codebase's Policy rows ever use. Pure/no I/O, so it's safe to import from
// both activities.ts (computing Approval.expiresAt for display) and
// workflows.ts (computing the escalation/remainder wait durations) —
// workflows.ts can't import activities.ts directly, so this lives here
// instead of being defined once in either of those files.
export function parseDurationToMs(duration: string): number {
  const match = duration.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|seconds?|m|minutes?|h|hours?|d|days?)$/i);
  if (!match) {
    throw new Error(`Cannot parse duration "${duration}"`);
  }
  const value = parseFloat(match[1]);
  const unitMs: Record<string, number> = {
    ms: 1,
    millisecond: 1,
    milliseconds: 1,
    s: 1000,
    second: 1000,
    seconds: 1000,
    m: 60_000,
    minute: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hour: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
  };
  return value * unitMs[match[2].toLowerCase()];
}
