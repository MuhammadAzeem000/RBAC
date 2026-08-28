import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alertsApi } from '@/api/alerts.api'
import { AlertStatusBadge, SeverityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useListState } from '@/hooks/useListState'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { AlertStatus, IncidentAlert, IncidentSeverity } from '@/types/incident'

const columnHelper = createColumnHelper<IncidentAlert>()

const STATUS_OPTIONS: AlertStatus[] = ['pending_case', 'linked', 'attached', 'failed']

export function AlertsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canIngest = can('Incidents', 'Create')
  const { page, pageSize, search, setPage, setPageSize, setSearch } = useListState()
  const [status, setStatus] = useState<AlertStatus | undefined>(undefined)

  const [ingestOpen, setIngestOpen] = useState(false)
  const [source, setSource] = useState('')
  const [externalId, setExternalId] = useState('')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')

  const query = useQuery({
    queryKey: ['alerts', { page, pageSize, search, status }],
    queryFn: () => alertsApi.list({ page, pageSize, search: search || undefined, status }),
    placeholderData: (prev) => prev,
  })

  const ingestMutation = useMutation({
    mutationFn: () => alertsApi.ingestTest({ source, externalId, severity, timestamp: new Date().toISOString() }),
    onSuccess: (alert) => {
      toast.success(alert.status === 'linked' ? 'Alert ingested and linked to a case' : 'Alert ingested — case creation pending')
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      setIngestOpen(false)
      setSource('')
      setExternalId('')
      setSeverity('medium')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('externalAlertId', {
      header: 'Alert',
      cell: (info) => (
        <div>
          <p className="font-medium text-slate-900">{info.getValue()}</p>
          {info.row.original.summary && (
            <p className="max-w-72 truncate text-xs text-slate-400">{info.row.original.summary}</p>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('source', {
      header: 'Source',
      cell: (info) => <span className="text-slate-600">{info.getValue()}</span>,
    }),
    columnHelper.accessor('severity', {
      header: 'Severity',
      cell: (info) => (info.getValue() ? <SeverityBadge severity={info.getValue()!} /> : <span className="text-slate-300">—</span>),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <AlertStatusBadge status={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'incident',
      header: 'Case',
      cell: (info) =>
        info.row.original.incidentId ? (
          <span className="font-mono text-xs text-blue-600">#{info.row.original.incidentId}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    }),
    columnHelper.accessor('attachedAt', {
      header: 'Received',
      cell: (info) => <span className="whitespace-nowrap text-xs text-slate-500">{new Date(info.getValue()).toLocaleString()}</span>,
    }),
  ]

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Every alert received across your organization, whether attached to a case or still pending one."
        actions={
          canIngest && (
            <Button variant="primary" onClick={() => setIngestOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              Ingest test alert
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
        searchPlaceholder="Search by external ID, source, or summary…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        onRowClick={(row) => row.incidentId && navigate(`/incidents/${row.incidentId}`)}
        toolbarExtra={
          <Select
            value={status ?? ''}
            onChange={(e) => setStatus(e.target.value === '' ? undefined : (e.target.value as AlertStatus))}
            aria-label="Filter by status"
            className="h-8! w-auto"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        }
        emptyTitle="No alerts yet"
        emptyDescription="Alerts from connected sources will appear here as they're received."
      />

      <Dialog open={ingestOpen} onClose={() => setIngestOpen(false)} title="Ingest test alert" size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Simulates an alert arriving from a source system — creates a new case automatically once it's linked.
          </p>
          <FormField label="Source" required>
            {(id) => <Input id={id} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. SIEM" />}
          </FormField>
          <FormField label="External alert ID" required>
            {(id) => <Input id={id} value={externalId} onChange={(e) => setExternalId(e.target.value)} />}
          </FormField>
          <FormField label="Severity" required>
            {(id) => (
              <Select id={id} value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            )}
          </FormField>
          <div className="mt-1 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIngestOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!source.trim() || !externalId.trim()}
              loading={ingestMutation.isPending}
              onClick={() => ingestMutation.mutate()}
            >
              Ingest
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
