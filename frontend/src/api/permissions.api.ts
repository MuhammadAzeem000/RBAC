import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { ListQuery, PaginatedResult } from '@/types/pagination'
import type { CreatePermissionInput, Permission, UpdatePermissionInput } from '@/types/permission'

export interface PermissionListQuery extends ListQuery {
  moduleId?: string
  actionId?: string
}

export const permissionsApi = {
  list: (query: PermissionListQuery) =>
    api.get<PaginatedResult<Permission>>('/permissions', { params: buildParams(query) }).then((r) => r.data),
  get: (id: string) => api.get<Permission>(`/permissions/${id}`).then((r) => r.data),
  create: (input: CreatePermissionInput) => api.post<Permission>('/permissions', input).then((r) => r.data),
  update: (id: string, input: UpdatePermissionInput) =>
    api.put<Permission>(`/permissions/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/permissions/${id}`).then((r) => r.data),
}
