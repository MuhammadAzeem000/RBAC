import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { ListQuery, PaginatedResult } from '@/types/pagination'
import type { AppModule, CreateModuleInput, UpdateModuleInput } from '@/types/module'

export const modulesApi = {
  list: (query: ListQuery) =>
    api.get<PaginatedResult<AppModule>>('/modules', { params: buildParams(query) }).then((r) => r.data),
  get: (id: string) => api.get<AppModule>(`/modules/${id}`).then((r) => r.data),
  create: (input: CreateModuleInput) => api.post<AppModule>('/modules', input).then((r) => r.data),
  update: (id: string, input: UpdateModuleInput) =>
    api.put<AppModule>(`/modules/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/modules/${id}`).then((r) => r.data),
}
