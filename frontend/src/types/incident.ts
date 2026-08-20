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

export interface IncidentAlert {
  id: string
  incidentId: string
  externalAlertId: string
  source: string
  summary: string
  rawPayload: unknown
  attachedBy: string
  attachedAt: string
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

export interface PlaybookRun {
  id: string
  incidentId: string
  playbookKey: string
  playbookVersion: string
  state: PlaybookRunState
  requiresApproval: boolean
  approvedBy: string | null
  approvedAt: string | null
  initiatedBy: string
  startedAt: string | null
  endedAt: string | null
  inputs: unknown
  outputsSummary: string | null
  errorMessage: string | null
  createdAt: string
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
