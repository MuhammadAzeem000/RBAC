import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type CheckboxProps = InputHTMLAttributes<HTMLInputElement>

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-3.5 rounded border-slate-300 text-blue-600 focus-visible:outline-blue-500',
        className,
      )}
      {...props}
    />
  )
})
Checkbox.displayName = 'Checkbox'
