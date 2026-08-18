import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { ListQuery, PaginatedResult } from '@/types/pagination'
import type { AssignedPermission, CreateRoleInput, Role, UpdateRoleInput } from '@/types/role'

export type RoleListQuery = ListQuery

export const rolesApi = {
  list: (query: RoleListQuery) =>
    api.get<PaginatedResult<Role>>('/roles', { params: buildParams(query) }).then((r) => r.data),
  get: (id: string) => api.get<Role>(`/roles/${id}`).then((r) => r.data),
  create: (input: CreateRoleInput) => api.post<Role>('/roles', input).then((r) => r.data),
  update: (id: string, input: UpdateRoleInput) => api.put<Role>(`/roles/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/roles/${id}`).then((r) => r.data),

  listPermissions: (roleId: string, query: ListQuery) =>
    api
      .get<PaginatedResult<AssignedPermission>>(`/roles/${roleId}/permissions`, { params: buildParams(query) })
      .then((r) => r.data),
  assignPermission: (roleId: string, permissionId: string) =>
    api.post(`/roles/${roleId}/permissions`, { permissionId }).then((r) => r.data),
  revokePermission: (roleId: string, permissionId: string) =>
    api.delete(`/roles/${roleId}/permissions/${permissionId}`).then((r) => r.data),
}
