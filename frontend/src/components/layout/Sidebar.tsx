import { NavLink } from 'react-router-dom'
import { ShieldHalf } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNavItems } from './navConfig'

interface SidebarProps {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const navItems = useNavItems()

  return (
    <div className="flex h-full w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-12 items-center gap-2 border-b border-slate-200 px-4">
        <ShieldHalf className="size-5 text-blue-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-900">VAPT Admin</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )
            }
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
