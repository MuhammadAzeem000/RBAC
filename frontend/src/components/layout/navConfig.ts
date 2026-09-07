import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Network,
  Plug,
  Radar,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { useMyEnabledModuleNames } from '@/hooks/useMyModules'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

// Dashboard is always shown — it isn't backed by a module permission.
const MODULE_GATED_ITEMS: { moduleName: string; item: NavItem }[] = [
  { moduleName: 'Incidents', item: { to: '/incidents', label: 'Incidents', icon: ShieldAlert } },
  // Gated on the same "Incidents" module as incidents — alert-ingestion-service's
  // own routes reuse that module's Create/View actions rather than a new one.
  { moduleName: 'Incidents', item: { to: '/alerts', label: 'Alerts', icon: Bell } },
  { moduleName: 'Connectors', item: { to: '/connectors', label: 'Connectors', icon: Plug } },
  { moduleName: 'Playbooks', item: { to: '/playbooks', label: 'Playbooks', icon: Workflow } },
  { moduleName: 'Threat Intel', item: { to: '/threat-intel', label: 'Threat Intelligence', icon: Radar } },
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
