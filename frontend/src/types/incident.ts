export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus =
  | 'new'
  | 'triage'
  | 'investigating'
  | 'containment'
  | 'remediation'
  | 'resolved'
  | 'closed'

export interface Incident {
  id: string
  externalId: string | null
  title: string
  description: string | null
  category: string | null
  severity: IncidentSeverity
  priority: string | null
  status: IncidentStatus
  tags: string[] | null
  source: string | null
  ownerUserId: string | null
  detectedAt: string | null
  dueAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  closureCode: string | null
  resolutionSummary: string | null
  rootCause: string | null
  createdBy: string
  updatedBy: string | null
  version: number
  createdAt: string
  updatedAt: string | null
}

export interface CreateIncidentInput {
  title: string
  description?: string
  category?: string
  severity: IncidentSeverity
  priority?: string
  tags?: string[]
  source?: string
}

export interface UpdateIncidentInput {
  title?: string
  description?: string
  category?: string
  severity?: IncidentSeverity
  priority?: string
  status?: IncidentStatus
  ownerUserId?: string | null
  dueAt?: string | null
  closureCode?: string
  resolutionSummary?: string
  rootCause?: string
  reopen?: boolean
  version?: number
}

export interface IncidentListQuery {
  page?: number
  pageSize?: number
  status?: IncidentStatus
  severity?: IncidentSeverity
  search?: string
}

// alert-ingestion-service's response shape (Phase 5.1's decomposition —
// alerts no longer live in incident-service). status distinguishes the
// synchronous human attach path ('attached') from the async
// ingest-and-create-a-case saga ('pending_case' -> 'linked', or 'failed').
export type AlertStatus = 'pending_case' | 'linked' | 'attached' | 'failed'

export interface AlertEntity {
  id: string
  type: string
  value: string
  confidence: number | null
  attributes: unknown
}

export interface IncidentAlert {
  id: string
  externalAlertId: string
  source: string
  summary: string | null
  severity: IncidentSeverity | null
  occurredAt: string | null
  rawRef: string | null
  status: AlertStatus
  incidentId: string | null
  errorMessage: string | null
  attachedBy: string
  attachedAt: string
  entities: AlertEntity[]
}

// The human "attach a related alert to an incident I already have open"
// path — a synchronous subset of alert-ingestion-service's full ingest
// request shape (source/externalId/severity/timestamp/entities/rawRef),
// with incidentId set so it resolves synchronously instead of going through
// the async ingest-and-create-a-case saga.
export interface AttachAlertInput {
  source: string
  externalId: string
  severity: IncidentSeverity
  timestamp: string
  incidentId: string
}

// The same shape with incidentId omitted — the async ingest-and-create-a-case
// saga (see the standalone Alerts page's "Ingest test alert" action), which
// resolves to 'pending_case' immediately and 'linked' once incident-service's
// reply arrives.
export type IngestTestAlertInput = Omit<AttachAlertInput, 'incidentId'>

export interface AlertListQuery {
  page?: number
  pageSize?: number
  status?: AlertStatus
  search?: string
}

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'

export interface IncidentTask {
  id: string
  incidentId: string
  title: string
  description: string | null
  assigneeUserId: string | null
  dueDate: string | null
  status: TaskStatus
  completedAt: string | null
  completedBy: string | null
  createdBy: string
  createdAt: string
  updatedAt: string | null
}

export interface IncidentEvidence {
  id: string
  incidentId: string
  filename: string
  fileType: string | null
  sizeBytes: string | null
  storageRef: string
  checksum: string | null
  provenance: string | null
  uploadedBy: string
  uploadedAt: string
}

export interface IncidentComment {
  id: string
  incidentId: string
  authorUserId: string
  body: string
  createdAt: string
  editedAt: string | null
}

export interface PlaybookCatalogEntry {
  key: string
  name: string
  description: string
  requiresApproval: boolean
}

export type PlaybookRunState = 'pending_approval' | 'running' | 'succeeded' | 'failed' | 'cancelled'

// playbook-service's response shape (Phase 5.2's decomposition — playbook
// runs no longer live in incident-service). approvedBy/approvedAt were
// dropped from the backend back in Phase 4 (replaced by the Approval table
// below) but never removed from this type until now.
export interface PlaybookRun {
  id: string
  incidentId: string
  playbookKey: string
  playbookVersion: string
  state: PlaybookRunState
  requiresApproval: boolean
  initiatedBy: string
  startedAt: string | null
  endedAt: string | null
  inputs: unknown
  outputsSummary: string | null
  errorMessage: string | null
  createdAt: string
}

export interface StartPlaybookRunInput {
  incidentId: string
  playbookKey: string
  inputs?: Record<string, unknown>
}

export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'expired'

export interface ApprovalResponse {
  id: string
  playbookRunId: string
  incidentId: string
  stepKey: string | null
  policyKey: string
  requestorUserId: string
  approverUserId: string | null
  decision: ApprovalDecision
  requestedAt: string
  decidedAt: string | null
  expiresAt: string | null
  escalatedAt: string | null
}

export interface TimelineEvent {
  id: string
  incidentId: string
  eventType: string
  actorUserId: string | null
  summary: string
  metadata: unknown
  createdAt: string
}
