import type { ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (id: string) => ReactNode
}

export function FormField({ label, htmlFor, error, hint, required, className, children }: FormFieldProps) {
  const generatedId = useId()
  const id = htmlFor ?? generatedId

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}
