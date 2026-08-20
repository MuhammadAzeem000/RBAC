import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { incidentsApi } from '@/api/incidents.api'
import { IncidentStatusBadge, SeverityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useListState } from '@/hooks/useListState'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { Incident, IncidentStatus, IncidentSeverity } from '@/types/incident'
import { IncidentForm, IncidentFormFooter } from './IncidentForm'
import type { IncidentFormValues } from './IncidentForm'

const columnHelper = createColumnHelper<Incident>()

function ageLabel(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return '<1h'
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function IncidentsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const { page, pageSize, search, setPage, setPageSize, setSearch } = useListState()
  const [status, setStatus] = useState<IncidentStatus | ''>('')
  const [severity, setSeverity] = useState<IncidentSeverity | ''>('')
  const [createOpen, setCreateOpen] = useState(false)

  const query = useQuery({
    queryKey: ['incidents', { page, pageSize, search, status, severity }],
    queryFn: () =>
      incidentsApi.list({
        page,
        pageSize,
        search,
        status: status || undefined,
        severity: severity || undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: (values: IncidentFormValues) =>
      incidentsApi.create({
        title: values.title,
        severity: values.severity,
        category: values.category || undefined,
        source: values.source || undefined,
        description: values.description || undefined,
      }),
    onSuccess: (incident) => {
      toast.success('Incident created')
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setCreateOpen(false)
      navigate(`/incidents/${incident.id}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('title', {
      header: 'Title',
      cell: (info) => (
        <div>
          <div className="font-medium text-slate-900">{info.getValue()}</div>
          <div className="text-xs text-slate-400">#{info.row.original.id}</div>
        </div>
      ),
    }),
    columnHelper.accessor('severity', { header: 'Severity', cell: (info) => <SeverityBadge severity={info.getValue()} /> }),
    columnHelper.accessor('status', { header: 'Status', cell: (info) => <IncidentStatusBadge status={info.getValue()} /> }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => info.getValue() ?? <span className="text-slate-300">—</span>,
    }),
    columnHelper.accessor('createdAt', { header: 'Age', cell: (info) => ageLabel(info.getValue()) }),
    columnHelper.accessor('dueAt', {
      header: 'Due',
      cell: (info) => {
        const dueAt = info.getValue()
        if (!dueAt) return <span className="text-slate-300">—</span>
        const overdue = new Date(dueAt).getTime() < Date.now() && info.row.original.status !== 'closed'
        return (
          <span className={overdue ? 'font-medium text-red-600' : 'text-slate-600'}>
            {new Date(dueAt).toLocaleDateString()}
            {overdue ? ' (overdue)' : ''}
          </span>
        )
      },
    }),
  ]

  const formId = 'incident-create-form'

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Triage, investigate, and resolve security incidents."
        actions={
          can('Incidents', 'Create') && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              New incident
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        pagination={query.data?.pagination ?? { page, pageSize, total: 0, totalPages: 1 }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, description, or external id…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        onRowClick={(row) => navigate(`/incidents/${row.id}`)}
        toolbarExtra={
          <>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus | '')}
              aria-label="Filter by status"
              className="w-auto"
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="triage">Triage</option>
              <option value="investigating">Investigating</option>
              <option value="containment">Containment</option>
              <option value="remediation">Remediation</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
            <Select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity | '')}
              aria-label="Filter by severity"
              className="w-auto"
            >
              <option value="">All severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </>
        }
        emptyTitle="No incidents found"
        emptyDescription="Create an incident, or wait for one to arrive from an alert integration."
      />

      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New incident"
        footer={
          <IncidentFormFooter formId={formId} saving={createMutation.isPending} onCancel={() => setCreateOpen(false)} />
        }
      >
        <IncidentForm formId={formId} onSubmit={(values) => createMutation.mutate(values)} />
      </Drawer>
    </div>
  )
}
