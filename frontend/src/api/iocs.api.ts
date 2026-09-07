import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { IocLookupResult, IocSearchQuery, StixObject } from '@/types/stixObject'

const base = '/v1/threat-intel/iocs'

export const iocsApi = {
  lookup: (value: string, type?: string) =>
    api
      .get<{ data: IocLookupResult }>(`${base}/lookup`, { params: buildParams({ value, type }) })
      .then((r) => r.data.data),
  search: (query: IocSearchQuery) =>
    api.get<{ data: StixObject[] }>(base, { params: buildParams(query) }).then((r) => r.data.data),
}
