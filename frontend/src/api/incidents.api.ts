import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { PaginatedResult } from '@/types/pagination'
import type {
  CreateIncidentInput,
  Incident,
  IncidentComment,
  IncidentEvidence,
  IncidentListQuery,
  IncidentTask,
  PlaybookCatalogEntry,
  PlaybookRun,
  TimelineEvent,
  UpdateIncidentInput,
} from '@/types/incident'

// incident-service is mounted behind the gateway at /api/v1/incidents — the
// only feature in this frontend that isn't under plain /api/... — see
// backend/api-gateway/src/server.ts.
const base = '/v1/incidents'

export const incidentsApi = {
  list: (query: IncidentListQuery) =>
    api.get<PaginatedResult<Incident>>(base, { params: buildParams(query) }).then((r) => r.data),
  get: (id: string) => api.get<Incident>(`${base}/${id}`).then((r) => r.data),
  create: (input: CreateIncidentInput) => api.post<Incident>(base, input).then((r) => r.data),
  update: (id: string, input: UpdateIncidentInput) =>
    api.patch<Incident>(`${base}/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`${base}/${id}`).then((r) => r.data),

  listComments: (id: string) =>
    api.get<{ data: IncidentComment[] }>(`${base}/${id}/comments`).then((r) => r.data.data),
  addComment: (id: string, body: string) =>
    api.post<IncidentComment>(`${base}/${id}/comments`, { body }).then((r) => r.data),

  listTasks: (id: string) => api.get<{ data: IncidentTask[] }>(`${base}/${id}/tasks`).then((r) => r.data.data),
  createTask: (id: string, input: { title: string; description?: string; dueDate?: string }) =>
    api.post<IncidentTask>(`${base}/${id}/tasks`, input).then((r) => r.data),
  updateTask: (
    id: string,
    taskId: string,
    input: Partial<{ title: string; description: string; dueDate: string | null; status: string }>,
  ) => api.patch<IncidentTask>(`${base}/${id}/tasks/${taskId}`, input).then((r) => r.data),

  listEvidence: (id: string) =>
    api.get<{ data: IncidentEvidence[] }>(`${base}/${id}/evidence`).then((r) => r.data.data),
  addEvidence: (
    id: string,
    input: { filename: string; fileType?: string; storageRef: string; checksum?: string; provenance?: string },
  ) => api.post<IncidentEvidence>(`${base}/${id}/evidence`, input).then((r) => r.data),

  playbookCatalog: () =>
    api.get<{ data: PlaybookCatalogEntry[] }>(`${base}/playbook-catalog`).then((r) => r.data.data),
  listPlaybookRuns: (id: string) =>
    api.get<{ data: PlaybookRun[] }>(`${base}/${id}/playbook-runs`).then((r) => r.data.data),
  startPlaybookRun: (id: string, playbookKey: string) =>
    api.post<PlaybookRun>(`${base}/${id}/playbook-runs`, { playbookKey }).then((r) => r.data),
  approvePlaybookRun: (id: string, runId: string) =>
    api.post<PlaybookRun>(`${base}/${id}/playbook-runs/${runId}/approve`).then((r) => r.data),

  getTimeline: (id: string, query: { page?: number; pageSize?: number }) =>
    api
      .get<PaginatedResult<TimelineEvent>>(`${base}/${id}/timeline`, { params: buildParams(query) })
      .then((r) => r.data),
}
