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

const SEVERITY_TONE: Record<string, Tone> = { low: 'slate', medium: 'amber', high: 'red', critical: 'red' }
const SEVERITY_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }

// Severity/status are also spelled out as text (not color alone) per the
// SOAR MVP spec's "must be scannable without relying on color alone" rule.
export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge tone={SEVERITY_TONE[severity] ?? 'slate'} className={severity === 'critical' ? 'font-semibold' : undefined}>
      {SEVERITY_LABEL[severity] ?? severity}
    </Badge>
  )
}

const INCIDENT_STATUS_TONE: Record<string, Tone> = {
  new: 'blue',
  triage: 'amber',
  investigating: 'amber',
  containment: 'amber',
  remediation: 'amber',
  resolved: 'green',
  closed: 'slate',
}
const INCIDENT_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  triage: 'Triage',
  investigating: 'Investigating',
  containment: 'Containment',
  remediation: 'Remediation',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function IncidentStatusBadge({ status }: { status: string }) {
  return <Badge tone={INCIDENT_STATUS_TONE[status] ?? 'slate'}>{INCIDENT_STATUS_LABEL[status] ?? status}</Badge>
}

const ALERT_STATUS_TONE: Record<string, Tone> = {
  pending_case: 'amber',
  linked: 'green',
  attached: 'green',
  failed: 'red',
}
const ALERT_STATUS_LABEL: Record<string, string> = {
  pending_case: 'Pending case',
  linked: 'Linked',
  attached: 'Attached',
  failed: 'Failed',
}

export function AlertStatusBadge({ status }: { status: string }) {
  return <Badge tone={ALERT_STATUS_TONE[status] ?? 'slate'}>{ALERT_STATUS_LABEL[status] ?? status}</Badge>
}

const POLL_STATUS_TONE: Record<string, Tone> = { succeeded: 'green', failed: 'red' }
const POLL_STATUS_LABEL: Record<string, string> = { succeeded: 'Succeeded', failed: 'Failed' }

export function PollStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="slate">Never polled</Badge>
  return <Badge tone={POLL_STATUS_TONE[status] ?? 'slate'}>{POLL_STATUS_LABEL[status] ?? status}</Badge>
}
