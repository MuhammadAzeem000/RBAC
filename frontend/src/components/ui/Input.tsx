import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900',
          'placeholder:text-slate-400',
          'focus-visible:border-blue-500',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          invalid && 'border-red-400 focus-visible:outline-red-500',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
