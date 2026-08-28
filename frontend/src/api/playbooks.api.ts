import { api } from '@/lib/api'
import type { PlaybookCatalogEntry, PlaybookRun, StartPlaybookRunInput } from '@/types/incident'

// playbook-service, mounted behind the gateway at /api/v1/playbook-catalog
// and /api/v1/playbook-runs — a separate service from incident-service
// since Phase 5.2's decomposition (see backend/api-gateway/src/server.ts).
const catalogBase = '/v1/playbook-catalog'
const runsBase = '/v1/playbook-runs'

export const playbooksApi = {
  catalog: () => api.get<{ data: PlaybookCatalogEntry[] }>(catalogBase).then((r) => r.data.data),
  listForIncident: (incidentId: string) =>
    api.get<{ data: PlaybookRun[] }>(runsBase, { params: { incidentId } }).then((r) => r.data.data),
  start: (input: StartPlaybookRunInput) => api.post<PlaybookRun>(runsBase, input).then((r) => r.data),
  cancel: (runId: string) => api.post<PlaybookRun>(`${runsBase}/${runId}/cancel`).then((r) => r.data),
}
