import type { ReactNode } from 'react'

export interface DescriptionField {
  label: string
  value: ReactNode
}

export function DescriptionList({ fields }: { fields: DescriptionField[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="text-xs font-medium text-slate-400">{field.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{field.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
