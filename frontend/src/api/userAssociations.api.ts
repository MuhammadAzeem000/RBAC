import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { ListQuery, PaginatedResult } from '@/types/pagination'
import type { AssignedRole } from '@/types/role'

export interface AssignedDepartment {
  id: string
  name: string
  code: string | null
  isPrimary: boolean
  assignedAt: string
}

export const userRolesApi = {
  list: (userId: string, query: ListQuery) =>
    api
      .get<PaginatedResult<AssignedRole>>(`/users/${userId}/roles`, { params: buildParams(query) })
      .then((r) => r.data),
  assign: (userId: string, roleId: string) =>
    api.post(`/users/${userId}/roles`, { roleId }).then((r) => r.data),
  revoke: (userId: string, roleId: string) =>
    api.delete(`/users/${userId}/roles/${roleId}`).then((r) => r.data),
}

export const userDepartmentsApi = {
  list: (userId: string, query: ListQuery) =>
    api
      .get<PaginatedResult<AssignedDepartment>>(`/users/${userId}/departments`, { params: buildParams(query) })
      .then((r) => r.data),
  assign: (userId: string, departmentId: string, isPrimary = false) =>
    api.post(`/users/${userId}/departments`, { departmentId, isPrimary }).then((r) => r.data),
  revoke: (userId: string, departmentId: string) =>
    api.delete(`/users/${userId}/departments/${departmentId}`).then((r) => r.data),
}
