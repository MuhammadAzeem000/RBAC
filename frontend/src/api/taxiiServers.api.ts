import { api } from '@/lib/api'
import type { CreateTaxiiServerInput, TaxiiServer, UpdateTaxiiServerInput } from '@/types/taxiiServer'

const base = '/v1/threat-intel/taxii-servers'

export const taxiiServersApi = {
  list: () => api.get<{ data: TaxiiServer[] }>(base).then((r) => r.data.data),
  create: (input: CreateTaxiiServerInput) =>
    api.post<{ data: TaxiiServer }>(base, input).then((r) => r.data.data),
  update: (id: string, input: UpdateTaxiiServerInput) =>
    api.put<{ data: TaxiiServer }>(`${base}/${id}`, input).then((r) => r.data.data),
  remove: (id: string) => api.delete(`${base}/${id}`).then((r) => r.data),
}
