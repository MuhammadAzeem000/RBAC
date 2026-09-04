import { api } from '@/lib/api'
import type { PlaybookCatalogEntry, PlaybookRun, StartPlaybookRunInput } from '@/types/incident'
import type { CreatePlaybookInput, PlaybookDetail, PlaybookSummary, SavePlaybookInput } from '@/types/playbook'

// playbook-service, mounted behind the gateway at /api/v1/playbook-catalog,
// /api/v1/playbook-runs, and /api/v1/playbooks (the Playbook Designer's own
// authoring API) — a separate service from incident-service since Phase
// 5.2's decomposition (see backend/api-gateway/src/server.ts).
const catalogBase = '/v1/playbook-catalog'
const runsBase = '/v1/playbook-runs'
const designerBase = '/v1/playbooks'

export const playbooksApi = {
  catalog: () => api.get<{ data: PlaybookCatalogEntry[] }>(catalogBase).then((r) => r.data.data),
  listForIncident: (incidentId: string) =>
    api.get<{ data: PlaybookRun[] }>(runsBase, { params: { incidentId } }).then((r) => r.data.data),
  start: (input: StartPlaybookRunInput) => api.post<PlaybookRun>(runsBase, input).then((r) => r.data),
  cancel: (runId: string) => api.post<PlaybookRun>(`${runsBase}/${runId}/cancel`).then((r) => r.data),

  // The designer's own CRUD — a version is immutable once published, so
  // there is no "update" beyond publishing a new one (see publishVersion).
  listDetailed: () => api.get<{ data: PlaybookSummary[] }>(designerBase).then((r) => r.data.data),
  getDetail: (key: string) => api.get<PlaybookDetail>(`${designerBase}/${key}`).then((r) => r.data),
  create: (input: CreatePlaybookInput) => api.post<PlaybookDetail>(designerBase, input).then((r) => r.data),
  publishVersion: (key: string, input: SavePlaybookInput) =>
    api.put<PlaybookDetail>(`${designerBase}/${key}`, input).then((r) => r.data),
}
