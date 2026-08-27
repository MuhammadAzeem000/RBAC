import { api } from '@/lib/api'
import type { AttachAlertInput, IncidentAlert } from '@/types/incident'

// alert-ingestion-service, mounted behind the gateway at /api/v1/alerts —
// a separate service from incident-service since Phase 5.1's decomposition
// (see backend/api-gateway/src/server.ts, where this prefix is matched
// before the more general /api/v1 -> incident-service one).
const base = '/v1/alerts'

export const alertsApi = {
  listForIncident: (incidentId: string) =>
    api.get<{ data: IncidentAlert[] }>(base, { params: { incidentId } }).then((r) => r.data.data),

  // incidentId set -> resolves synchronously (status 'attached'); this is
  // the only ingest mode the frontend exposes today. Omitting it would
  // instead kick off the async ingest-and-create-a-case saga, which has no
  // UI surface yet. entities/rawRef aren't collected by this form, but
  // @responderx/shared's alertSchema requires rawRef present (nullable, not
  // optional) — sent explicitly rather than left undefined.
  attach: (input: AttachAlertInput) =>
    api.post<{ alert: IncidentAlert }>(base, { ...input, entities: [], rawRef: null }).then((r) => r.data.alert),
}
