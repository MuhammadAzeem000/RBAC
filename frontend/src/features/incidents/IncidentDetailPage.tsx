import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { incidentsApi } from '@/api/incidents.api'
import { usersApi } from '@/api/users.api'
import { IncidentStatusBadge, SeverityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs } from '@/components/ui/Tabs'
import { Textarea } from '@/components/ui/Textarea'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { Incident, IncidentSeverity, IncidentStatus } from '@/types/incident'
import { AlertsPanel } from './panels/AlertsPanel'
import { CommentsPanel } from './panels/CommentsPanel'
import { EvidencePanel } from './panels/EvidencePanel'
import { ResponsePanel } from './panels/ResponsePanel'
import { TasksPanel } from './panels/TasksPanel'
import { ActivityPanel } from './panels/ActivityPanel'

const STATUS_OPTIONS: IncidentStatus[] = [
  'new',
  'triage',
  'investigating',
  'containment',
  'remediation',
  'resolved',
  'closed',
]

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'investigation', label: 'Investigation' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'response', label: 'Response' },
  { key: 'activity', label: 'Activity' },
]

function OverviewTab({ incident }: { incident: Incident }) {
  return (
    <Card>
      <CardBody>
        <DescriptionList
          fields={[
            { label: 'Category', value: incident.category },
            { label: 'Priority', value: incident.priority },
            { label: 'Source', value: incident.source },
            { label: 'Tags', value: incident.tags?.join(', ') },
            { label: 'Detected', value: incident.detectedAt && new Date(incident.detectedAt).toLocaleString() },
            { label: 'Due', value: incident.dueAt && new Date(incident.dueAt).toLocaleString() },
            { label: 'Created', value: new Date(incident.createdAt).toLocaleString() },
            { label: 'Resolved', value: incident.resolvedAt && new Date(incident.resolvedAt).toLocaleString() },
            { label: 'Closed', value: incident.closedAt && new Date(incident.closedAt).toLocaleString() },
          ]}
        />
        {incident.description && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-400">Description</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{incident.description}</p>
          </div>
        )}
        {incident.status === 'closed' && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-400">Closure</p>
            <p className="mt-0.5 text-sm text-slate-700">
              {incident.closureCode} — {incident.resolutionSummary}
            </p>
            {incident.rootCause && <p className="mt-1 text-sm text-slate-600">Root cause: {incident.rootCause}</p>}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

export function IncidentDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canUpdate = can('Incidents', 'Update')
  const [tab, setTab] = useState('overview')
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closureCode, setClosureCode] = useState('')
  const [resolutionSummary, setResolutionSummary] = useState('')

  const query = useQuery({ queryKey: ['incidents', id], queryFn: () => incidentsApi.get(id) })
  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
    enabled: canUpdate,
  })

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof incidentsApi.update>[1]) => incidentsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents', id] })
      queryClient.invalidateQueries({ queryKey: ['incidents', id, 'timeline'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
  }

  const incident = query.data
  const users = usersQuery.data?.data ?? []

  function handleStatusChange(nextStatus: IncidentStatus) {
    if (nextStatus === 'closed') {
      setCloseDialogOpen(true)
      return
    }
    updateMutation.mutate({ status: nextStatus, version: incident.version })
  }

  function handleClose() {
    updateMutation.mutate(
      { status: 'closed', closureCode, resolutionSummary, version: incident.version },
      {
        onSuccess: () => {
          toast.success('Incident closed')
          setCloseDialogOpen(false)
          setClosureCode('')
          setResolutionSummary('')
        },
      },
    )
  }

  function handleReopen() {
    updateMutation.mutate(
      { status: 'investigating', reopen: true, version: incident.version },
      { onSuccess: () => toast.success('Incident reopened') },
    )
  }

  return (
    <div>
      <Link to="/incidents" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to incidents
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{incident.title}</h1>
            <SeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-400">#{incident.id}</p>
        </div>

        {canUpdate && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value=""
              onChange={(e) => handleStatusChange(e.target.value as IncidentStatus)}
              aria-label="Change severity"
              className="w-auto"
              disabled={incident.status === 'closed' || updateMutation.isPending}
            >
              <option value="" disabled>
                Change severity…
              </option>
              {(['low', 'medium', 'high', 'critical'] as IncidentSeverity[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>

            {incident.status === 'closed' ? (
              <Button variant="secondary" onClick={handleReopen} loading={updateMutation.isPending}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reopen
              </Button>
            ) : (
              <Select
                value={incident.status}
                onChange={(e) => handleStatusChange(e.target.value as IncidentStatus)}
                aria-label="Change status"
                className="w-auto"
                disabled={updateMutation.isPending}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}

            <Select
              value={incident.ownerUserId ?? ''}
              onChange={(e) =>
                updateMutation.mutate({ ownerUserId: e.target.value || null, version: incident.version })
              }
              aria-label="Assign owner"
              className="w-auto"
              disabled={incident.status === 'closed' || updateMutation.isPending}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="mb-4">
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && <OverviewTab incident={incident} />}
      {tab === 'alerts' && <AlertsPanel incidentId={id} />}
      {tab === 'investigation' && (
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Notes</p>
            <CommentsPanel incidentId={id} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Evidence</p>
            <EvidencePanel incidentId={id} />
          </div>
        </div>
      )}
      {tab === 'tasks' && <TasksPanel incidentId={id} />}
      {tab === 'response' && <ResponsePanel incidentId={id} />}
      {tab === 'activity' && <ActivityPanel incidentId={id} />}

      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} title="Close incident" size="sm">
        <div className="flex flex-col gap-3">
          <FormField label="Closure code" required>
            {(fid) => (
              <Select id={fid} value={closureCode} onChange={(e) => setClosureCode(e.target.value)}>
                <option value="">Select…</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False positive</option>
                <option value="duplicate">Duplicate</option>
                <option value="no_action_required">No action required</option>
              </Select>
            )}
          </FormField>
          <FormField label="Resolution summary" required>
            {(fid) => (
              <Textarea
                id={fid}
                rows={3}
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCloseDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!closureCode || !resolutionSummary.trim()}
            loading={updateMutation.isPending}
            onClick={handleClose}
          >
            Close incident
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
