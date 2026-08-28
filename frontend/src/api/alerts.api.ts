import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { PaginatedResult } from '@/types/pagination'
import type { AlertListQuery, AttachAlertInput, IncidentAlert, IngestTestAlertInput } from '@/types/incident'

// alert-ingestion-service, mounted behind the gateway at /api/v1/alerts —
// a separate service from incident-service since Phase 5.1's decomposition
// (see backend/api-gateway/src/server.ts, where this prefix is matched
// before the more general /api/v1 -> incident-service one).
const base = '/v1/alerts'

export const alertsApi = {
  // The tenant-wide alert inbox (no incidentId) — paginated, distinct from
  // listForIncident below (unpaginated, scoped to one incident).
  list: (query: AlertListQuery) =>
    api.get<PaginatedResult<IncidentAlert>>(base, { params: buildParams(query) }).then((r) => r.data),

  listForIncident: (incidentId: string) =>
    api.get<{ data: IncidentAlert[] }>(base, { params: { incidentId } }).then((r) => r.data.data),

  // incidentId set -> resolves synchronously (status 'attached'). entities/
  // rawRef aren't collected by this form, but @responderx/shared's
  // alertSchema requires rawRef present (nullable, not optional) — sent
  // explicitly rather than left undefined.
  attach: (input: AttachAlertInput) =>
    api.post<{ alert: IncidentAlert }>(base, { ...input, entities: [], rawRef: null }).then((r) => r.data.alert),

  // incidentId omitted -> the async ingest-and-create-a-case saga (see the
  // Alerts page's "Ingest test alert" action) — resolves to 'pending_case'
  // immediately, 'linked' once incident-service's reply arrives.
  ingestTest: (input: IngestTestAlertInput) =>
    api
      .post<{ alert: IncidentAlert }>(base, { ...input, entities: [], rawRef: null })
      .then((r) => r.data.alert),
}
