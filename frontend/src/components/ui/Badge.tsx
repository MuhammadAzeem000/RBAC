import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'slate' | 'green' | 'red' | 'amber' | 'blue'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

const toneClasses: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
}

export function Badge({ children, tone = 'slate', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge tone={isActive ? 'green' : 'slate'}>
      <span
        className={cn('mr-1 size-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-slate-400')}
        aria-hidden="true"
      />
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  )
}
