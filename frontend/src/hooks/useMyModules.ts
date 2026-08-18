import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/stores/authStore'

function useModuleAccessQuery() {
  const accessToken = useAuthStore((state) => state.accessToken)
  return useQuery({
    queryKey: ['auth', 'me', 'modules'],
    queryFn: () => authApi.myModules(),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  })
}

/**
 * Names of the modules the current user's roles grant any permission on.
 * Used to filter nav links to whichever sections this user can actually use.
 */
export function useMyEnabledModuleNames(): Set<string> {
  const query = useModuleAccessQuery()
  return new Set((query.data ?? []).filter((module) => module.isEnabled).map((module) => module.name))
}

/**
 * Per-action permission check (e.g. `can('Users', 'Create')`). Used to hide
 * action controls (New/Edit/Delete/Assign/Revoke) the current user's roles
 * don't grant, rather than showing them and letting the request 403.
 */
export function useMyPermissions(): { can: (moduleName: string, actionName: string) => boolean } {
  const query = useModuleAccessQuery()
  const actionsByModule = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const module of query.data ?? []) map.set(module.name, new Set(module.actions))
    return map
  }, [query.data])

  return {
    can: (moduleName, actionName) => actionsByModule.get(moduleName)?.has(actionName) ?? false,
  }
}
