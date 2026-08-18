import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900',
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
Textarea.displayName = 'Textarea'
