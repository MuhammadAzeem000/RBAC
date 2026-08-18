import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/stores/authStore'

/**
 * Names of the modules the current user's roles grant any permission on.
 * Used to filter nav links to whichever sections this user can actually use.
 */
export function useMyEnabledModuleNames(): Set<string> {
  const accessToken = useAuthStore((state) => state.accessToken)
  const query = useQuery({
    queryKey: ['auth', 'me', 'modules'],
    queryFn: () => authApi.myModules(),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  })
  return new Set((query.data ?? []).filter((module) => module.isEnabled).map((module) => module.name))
}
