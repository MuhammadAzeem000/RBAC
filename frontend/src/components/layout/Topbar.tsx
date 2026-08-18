import { useState } from 'react'
import { LogOut, Menu, User as UserIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useLogout } from '@/hooks/useAuth'
import { IconButton } from '@/components/ui/IconButton'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="flex h-12 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
      <div className="flex items-center gap-2">
        <IconButton label="Open navigation" onClick={onMenuClick} className="md:hidden">
          <Menu className="size-4.5" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <UserIcon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="hidden max-w-32 truncate font-medium sm:inline-block">
            {user?.name ?? 'Account'}
          </span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            >
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => logout.mutate()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="size-3.5" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
