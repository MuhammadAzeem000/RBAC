export interface PlaybookStep {
  key: string
  name: string
  connector?: string
  action?: string
  policyKey?: string
  config: Record<string, unknown>
  // Canvas layout only — never read by execution.
  position?: { x: number; y: number }
}

export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists'

export interface StepCondition {
  field: string
  operator: ConditionOperator
  value?: unknown
}

export interface PlaybookEdge {
  id: string
  source: string
  target: string
  condition?: StepCondition
}

export interface PlaybookSummary {
  key: string
  name: string
  description: string | null
  version: string
  requiresApproval: boolean
  startPolicyKey: string | null
  stepCount: number
  createdAt: string
}

export interface PlaybookVersionSummary {
  version: string
  createdAt: string
}

export interface PlaybookDetail {
  key: string
  name: string
  description: string | null
  version: string
  requiresApproval: boolean
  startPolicyKey: string | null
  steps: PlaybookStep[]
  // Empty means "no explicit graph" — the canvas synthesizes an implicit
  // linear chain over `steps` for display in that case (matching the
  // backend's own fallback when executing).
  edges: PlaybookEdge[]
  versions: PlaybookVersionSummary[]
  createdAt: string
}

// Shared by create (key required, immutable once set) and publish-a-new-version
// (key omitted — see api/playbooks.api.ts).
export interface SavePlaybookInput {
  name: string
  description?: string
  startPolicyKey?: string
  steps: PlaybookStep[]
  edges: PlaybookEdge[]
}

export interface CreatePlaybookInput extends SavePlaybookInput {
  key: string
}

// Read-only today — see the Playbook Designer plan's decision 7 (Policy
// authoring is a separate, deferred feature).
export interface Policy {
  key: string
  name: string
  timeoutDuration: string
  escalationAfter: string | null
  escalationChannel: string | null
}
