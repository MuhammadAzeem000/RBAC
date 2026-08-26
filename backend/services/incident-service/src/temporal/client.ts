// Plain Node context — this is what playbookRun.service.ts calls to start/
// signal/cancel workflows. Deliberately does NOT import workflows.ts: that
// module calls proxyActivities() at module scope, which throws outside an
// active workflow execution context. Only ./types (no such call) and string
// workflow-type names cross that boundary here.
import { Client, Connection, WorkflowIdReusePolicy } from "@temporalio/client";
import type { PlaybookStep } from "@responderx/shared";
import { env } from "../config/env";
import { approveSignal, PLAYBOOK_TASK_QUEUE, PLAYBOOK_WORKFLOW_TYPE, PlaybookRunWorkflowInput } from "./types";

let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: env.TEMPORAL_ADDRESS }).then(
      (connection) => new Client({ connection }),
    );
  }
  return clientPromise;
}

export function workflowIdFor(tenantId: bigint, runId: bigint): string {
  return `playbook-run-${tenantId}-${runId}`;
}

export interface StartPlaybookRunWorkflowInput {
  runId: bigint;
  tenantId: bigint;
  incidentId: bigint;
  playbookName: string;
  requiresApproval: boolean;
  steps: PlaybookStep[];
}

export async function startPlaybookRunWorkflow(input: StartPlaybookRunWorkflowInput): Promise<string> {
  const client = await getClient();
  const workflowId = workflowIdFor(input.tenantId, input.runId);
  const workflowInput: PlaybookRunWorkflowInput = {
    runId: input.runId.toString(),
    tenantId: input.tenantId.toString(),
    incidentId: input.incidentId.toString(),
    playbookName: input.playbookName,
    requiresApproval: input.requiresApproval,
    steps: input.steps,
    approvalTimeout: env.PLAYBOOK_APPROVAL_TIMEOUT,
  };

  const handle = await client.workflow.start(PLAYBOOK_WORKFLOW_TYPE, {
    taskQueue: PLAYBOOK_TASK_QUEUE,
    workflowId,
    workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE,
    args: [workflowInput],
  });
  return handle.workflowId;
}

export async function signalApproval(workflowId: string, approverId: bigint): Promise<void> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.signal(approveSignal, { approverId: approverId.toString() });
}

export async function cancelPlaybookRunWorkflow(workflowId: string): Promise<void> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.cancel();
}
