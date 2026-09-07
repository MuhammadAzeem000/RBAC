import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { StixObject } from '@/types/stixObject'

const base = '/v1/threat-intel/stix-objects'

export const stixObjectsApi = {
  list: (query: { type?: string; label?: string }) =>
    api.get<{ data: StixObject[] }>(base, { params: buildParams(query) }).then((r) => r.data.data),
  get: (stixId: string) => api.get<{ data: StixObject }>(`${base}/${encodeURIComponent(stixId)}`).then((r) => r.data.data),
}
