import { defineSignal } from "@temporalio/workflow";
import type { PlaybookStep } from "@responderx/shared";

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
  playbookName: string;
  requiresApproval: boolean;
  steps: PlaybookStep[];
  // A duration string in the SDK's human-readable format (e.g. "24 hours").
  // Threaded through from config rather than hardcoded so the expiry path
  // is actually testable without waiting a real day — see config/env.ts.
  approvalTimeout: string;
}

export interface ApprovalSignalInput {
  approverId: string;
}

export const approveSignal = defineSignal<[ApprovalSignalInput]>("approve");

export const PLAYBOOK_TASK_QUEUE = "soar-playbooks";
export const PLAYBOOK_WORKFLOW_TYPE = "playbookRunWorkflow";
