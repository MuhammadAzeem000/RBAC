import { Select } from './Select'

interface ActiveFilterSelectProps {
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
}

export function ActiveFilterSelect({ value, onChange }: ActiveFilterSelectProps) {
  return (
    <Select
      value={value === undefined ? '' : String(value)}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? undefined : v === 'true')
      }}
      aria-label="Filter by status"
      className="h-8! w-auto"
    >
      <option value="">All statuses</option>
      <option value="true">Active only</option>
      <option value="false">Inactive only</option>
    </Select>
  )
}
