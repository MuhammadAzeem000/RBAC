import type { LucideIcon } from 'lucide-react'
import { KeyRound, LayoutDashboard, LayoutGrid, Network, ScrollText, ShieldCheck, Users, Zap } from 'lucide-react'
import { useMyEnabledModuleNames } from '@/hooks/useMyModules'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

// Dashboard is always shown — it isn't backed by a module permission.
const MODULE_GATED_ITEMS: { moduleName: string; item: NavItem }[] = [
  { moduleName: 'Users', item: { to: '/users', label: 'Users', icon: Users } },
  { moduleName: 'Departments', item: { to: '/departments', label: 'Departments', icon: Network } },
  { moduleName: 'Roles', item: { to: '/roles', label: 'Roles', icon: ShieldCheck } },
  { moduleName: 'Modules', item: { to: '/modules', label: 'Modules', icon: LayoutGrid } },
  { moduleName: 'Actions', item: { to: '/actions', label: 'Actions', icon: Zap } },
  { moduleName: 'Permissions', item: { to: '/permissions', label: 'Permissions', icon: KeyRound } },
  { moduleName: 'Audit Logs', item: { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText } },
]

export function useNavItems(): NavItem[] {
  const enabledModules = useMyEnabledModuleNames()

  const items: NavItem[] = [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }]

  for (const { moduleName, item } of MODULE_GATED_ITEMS) {
    if (enabledModules.has(moduleName)) items.push(item)
  }

  return items
}
