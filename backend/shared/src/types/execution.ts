import { z } from "zod";

// Durable run state (MVP plan §4). Nothing in Phase 1 executes against this
// shape yet — incident-service's PlaybookRun table is still the concrete
// record — but Phase 2's orchestration engine is expected to model
// Execution/StepExecution/ActionResult exactly like this, so the shape is
// defined now while the domain model is being centralized.
export const executionStateSchema = z.enum([
  "pending_approval",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type ExecutionState = z.infer<typeof executionStateSchema>;

export const executionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  caseId: z.string(),
  playbookVersionId: z.string(),
  state: executionStateSchema,
  context: z.record(z.string(), z.unknown()).default({}),
  correlationId: z.string(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});
export type Execution = z.infer<typeof executionSchema>;

export const stepExecutionStateSchema = z.enum(["pending", "running", "succeeded", "failed", "skipped"]);
export type StepExecutionState = z.infer<typeof stepExecutionStateSchema>;

export const stepExecutionSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  stepKey: z.string(),
  status: stepExecutionStateSchema,
  input: z.record(z.string(), z.unknown()).nullable(),
  output: z.record(z.string(), z.unknown()).nullable(),
  attempts: z.number().int().min(0),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
});
export type StepExecution = z.infer<typeof stepExecutionSchema>;

// Normalized record of every external (connector) call an execution makes.
export const actionResultSchema = z.object({
  id: z.string(),
  stepExecutionId: z.string(),
  connector: z.string(),
  action: z.string(),
  requestRef: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
});
export type ActionResult = z.infer<typeof actionResultSchema>;
