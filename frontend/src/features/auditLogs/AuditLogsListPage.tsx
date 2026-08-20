import { createColumnHelper } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { auditLogsApi } from '@/api/auditLogs.api'
import { DataTable } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { useListState } from '@/hooks/useListState'
import { getErrorMessage } from '@/lib/errors'
import type { AuditLogEntry } from '@/types/auditLog'

const columnHelper = createColumnHelper<AuditLogEntry>()

export function AuditLogsListPage() {
  const { page, pageSize, setPage, setPageSize } = useListState()
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['audit-logs', { page, pageSize }],
    queryFn: () => auditLogsApi.list({ page, pageSize }),
    placeholderData: (prev) => prev,
  })

  const filtered = useMemo(() => {
    const rows = query.data?.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.resourceType.toLowerCase().includes(q) ||
        log.service.toLowerCase().includes(q) ||
        (log.actorId ?? '').includes(q),
    )
  }, [query.data, search])

  const columns = [
    columnHelper.accessor('action', {
      header: 'Action',
      cell: (info) => <span className="font-mono text-xs text-slate-800">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'target',
      header: 'Target',
      cell: (info) => {
        const log = info.row.original
        return (
          <span className="text-slate-700">
            {log.resourceType}
            {log.resourceId ? ` #${log.resourceId}` : ''}
          </span>
        )
      },
    }),
    columnHelper.accessor('actorId', {
      header: 'Actor',
      cell: (info) => {
        const actorId = info.getValue()
        const log = info.row.original
        return (
          <span className="text-slate-700">
            {actorId ? `User #${actorId}` : log.actorType}
          </span>
        )
      },
    }),
    columnHelper.accessor('service', {
      header: 'Service',
      cell: (info) => <span className="text-xs text-slate-500">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'metadata',
      header: 'Details',
      cell: (info) => {
        const details = info.row.original.metadata ?? info.row.original.payload
        return details ? (
          <span className="block max-w-64 truncate font-mono text-xs text-slate-400">
            {JSON.stringify(details)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )
      },
    }),
    columnHelper.accessor('occurredAt', {
      header: 'When',
      cell: (info) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {new Date(info.getValue()).toLocaleString()}
        </span>
      ),
    }),
  ]

  return (
    <div>
      <PageHeader title="Audit Logs" description="A record of changes made across your organization." />

      <DataTable
        columns={columns}
        data={filtered}
        pagination={query.data?.pagination ?? { page, pageSize, total: 0, totalPages: 1 }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter this page by action, target, or actor…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        emptyTitle="No audit log entries"
        emptyDescription="Actions taken across your organization will appear here."
      />
    </div>
  )
}
