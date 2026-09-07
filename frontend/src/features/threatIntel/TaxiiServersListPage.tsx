import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Pencil, Plus, Search, Trash2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { taxiiServersApi } from '@/api/taxiiServers.api'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { useListState } from '@/hooks/useListState'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { TaxiiServer } from '@/types/taxiiServer'
import { TaxiiServerForm, TaxiiServerFormFooter, toTaxiiServerInput } from './TaxiiServerForm'
import type { TaxiiServerFormValues } from './TaxiiServerForm'

const columnHelper = createColumnHelper<TaxiiServer>()

// The list endpoint returns the full set (no page/total) — this is a
// tenant-admin config list, expected to stay small, so pagination/search
// are handled client-side rather than round-tripping to the server.
export function TaxiiServersListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const { page, pageSize, search, setPage, setPageSize, setSearch } = useListState()

  const [drawerServer, setDrawerServer] = useState<TaxiiServer | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaxiiServer | null>(null)

  const query = useQuery({ queryKey: ['taxii-servers'], queryFn: () => taxiiServersApi.list() })

  const createMutation = useMutation({
    mutationFn: (values: TaxiiServerFormValues) => taxiiServersApi.create(toTaxiiServerInput(values)),
    onSuccess: () => {
      toast.success('TAXII server added')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers'] })
      setDrawerServer(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TaxiiServerFormValues }) =>
      taxiiServersApi.update(id, toTaxiiServerInput(values)),
    onSuccess: () => {
      toast.success('TAXII server updated')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers'] })
      setDrawerServer(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taxiiServersApi.remove(id),
    onSuccess: () => {
      toast.success('TAXII server removed')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers'] })
      setDeleteTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const allServers = query.data ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allServers
    return allServers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.discoveryUrl.toLowerCase().includes(q),
    )
  }, [allServers, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const columns = [
    columnHelper.accessor('name', {
      header: 'Server',
      cell: (info) => <div className="font-medium text-slate-900">{info.getValue()}</div>,
    }),
    columnHelper.accessor('discoveryUrl', { header: 'Discovery URL' }),
    columnHelper.accessor('authType', {
      header: 'Auth',
      cell: (info) => <span className="capitalize">{info.getValue()}</span>,
    }),
    columnHelper.accessor('credentialConfigured', {
      header: 'Credentials',
      cell: (info) =>
        info.getValue() ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Configured
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <XCircle className="size-3.5" aria-hidden="true" /> Not set
          </span>
        ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge isActive={info.getValue() === 'enabled'} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const server = info.row.original
        return (
          <div className="flex justify-end gap-1">
            {can('Threat Intel', 'Update') && (
              <IconButton
                label="Edit server"
                onClick={(e) => {
                  e.stopPropagation()
                  setDrawerServer(server)
                }}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
            {can('Threat Intel', 'Delete') && (
              <IconButton
                label="Delete server"
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(server)
                }}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )
      },
    }),
  ]

  const formId = 'taxii-server-form'
  const isEditing = drawerServer !== null && drawerServer !== 'new'

  return (
    <div>
      <PageHeader
        title="Threat Intelligence"
        description="STIX/TAXII 2.1 feed sources polled for indicators of compromise."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/threat-intel/iocs')}>
              <Search className="size-3.5" aria-hidden="true" />
              Search IOCs
            </Button>
            {can('Threat Intel', 'Create') && (
              <Button variant="primary" onClick={() => setDrawerServer('new')}>
                <Plus className="size-3.5" aria-hidden="true" />
                New TAXII server
              </Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        data={pageRows}
        pagination={{ page: currentPage, pageSize, total: filtered.length, totalPages: pageCount }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or URL…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        onRowClick={(row) => navigate(`/threat-intel/servers/${row.id}`)}
        emptyTitle="No TAXII servers configured"
        emptyDescription="Add a TAXII 2.1 server to start polling threat intel feeds."
      />

      <Drawer
        open={drawerServer !== null}
        onClose={() => setDrawerServer(null)}
        title={isEditing ? 'Edit TAXII server' : 'New TAXII server'}
        footer={
          <TaxiiServerFormFooter
            formId={formId}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawerServer(null)}
          />
        }
      >
        <TaxiiServerForm
          formId={formId}
          defaultValues={isEditing ? (drawerServer as TaxiiServer) : undefined}
          onSubmit={(values) => {
            if (isEditing) updateMutation.mutate({ id: (drawerServer as TaxiiServer).id, values })
            else createMutation.mutate(values)
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete TAXII server"
        description={`Delete "${deleteTarget?.name}"? Its configured collections will stop being polled.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
