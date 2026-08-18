import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-8 w-full appearance-none rounded-md border border-slate-300 bg-white pl-2.5 pr-7 text-sm text-slate-900',
            'focus-visible:border-blue-500',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            invalid && 'border-red-400 focus-visible:outline-red-500',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    )
  },
)
Select.displayName = 'Select'
