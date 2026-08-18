import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'default' | 'danger'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: Variant
}

const variantClasses: Record<Variant, string> = {
  default: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  danger: 'text-slate-500 hover:bg-red-50 hover:text-red-600',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'default', label, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-40',
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)
IconButton.displayName = 'IconButton'
