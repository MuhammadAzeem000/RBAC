import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { ListQuery, PaginatedResult } from '@/types/pagination'
import type { Action, CreateActionInput, UpdateActionInput } from '@/types/action'

export const actionsApi = {
  list: (query: ListQuery) =>
    api.get<PaginatedResult<Action>>('/actions', { params: buildParams(query) }).then((r) => r.data),
  get: (id: string) => api.get<Action>(`/actions/${id}`).then((r) => r.data),
  create: (input: CreateActionInput) => api.post<Action>('/actions', input).then((r) => r.data),
  update: (id: string, input: UpdateActionInput) =>
    api.put<Action>(`/actions/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/actions/${id}`).then((r) => r.data),
}
