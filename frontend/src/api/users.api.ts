import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { ListQuery, PaginatedResult } from '@/types/pagination'
import type { CreateUserInput, UpdateUserInput, User } from '@/types/user'

export type UserListQuery = ListQuery

export const usersApi = {
  list: (query: UserListQuery) =>
    api.get<PaginatedResult<User>>('/users', { params: buildParams(query) }).then((r) => r.data),
  get: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),
  create: (input: CreateUserInput) => api.post<User>('/users', input).then((r) => r.data),
  update: (id: string, input: UpdateUserInput) => api.put<User>(`/users/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
}
