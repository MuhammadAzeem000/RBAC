import { useQuery } from '@tanstack/react-query'
import { userDepartmentsApi, userRolesApi } from '@/api/userAssociations.api'
import { useAuthStore } from '@/stores/authStore'

/**
 * IDs of the roles/departments assigned to the currently logged-in user.
 * Used to block deleting a role or department the user themselves depends on.
 */
export function useMyRoleIds(): Set<string> {
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const query = useQuery({
    queryKey: ['users', userId, 'roles'],
    queryFn: () => userRolesApi.list(userId, { page: 1, pageSize: 100 }),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
  return new Set(query.data?.data.map((role) => role.id) ?? [])
}

export function useMyDepartmentIds(): Set<string> {
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const query = useQuery({
    queryKey: ['users', userId, 'departments'],
    queryFn: () => userDepartmentsApi.list(userId, { page: 1, pageSize: 100 }),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
  return new Set(query.data?.data.map((department) => department.id) ?? [])
}
