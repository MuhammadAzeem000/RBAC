import { api } from '@/lib/api'
import type {
  CreateTaxiiCollectionInput,
  DiscoveredCollection,
  TaxiiCollection,
  UpdateTaxiiCollectionInput,
} from '@/types/taxiiCollection'

const base = '/v1/threat-intel'

export const taxiiCollectionsApi = {
  discover: (serverId: string) =>
    api
      .get<{ data: DiscoveredCollection[] }>(`${base}/taxii-servers/${serverId}/collections/discover`)
      .then((r) => r.data.data),
  list: (serverId: string) =>
    api
      .get<{ data: TaxiiCollection[] }>(`${base}/taxii-servers/${serverId}/collections`)
      .then((r) => r.data.data),
  create: (serverId: string, input: CreateTaxiiCollectionInput) =>
    api
      .post<{ data: TaxiiCollection }>(`${base}/taxii-servers/${serverId}/collections`, input)
      .then((r) => r.data.data),
  update: (id: string, input: UpdateTaxiiCollectionInput) =>
    api.put<{ data: TaxiiCollection }>(`${base}/taxii-collections/${id}`, input).then((r) => r.data.data),
  remove: (id: string) => api.delete(`${base}/taxii-collections/${id}`).then((r) => r.data),
  // Synchronous — the backend awaits the poll and returns the updated row
  // directly, so there's no separate job-status to poll for afterwards.
  pollNow: (id: string) =>
    api.post<{ data: TaxiiCollection }>(`${base}/taxii-collections/${id}/poll`).then((r) => r.data.data),
  status: (id: string) =>
    api.get<{ data: TaxiiCollection }>(`${base}/taxii-collections/${id}/status`).then((r) => r.data.data),
}
