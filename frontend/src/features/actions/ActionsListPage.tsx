import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { actionsApi } from '@/api/actions.api'
import { ActiveFilterSelect } from '@/components/ui/ActiveFilterSelect'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { useListState } from '@/hooks/useListState'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { Action } from '@/types/action'
import { ActionForm, ActionFormFooter } from './ActionForm'
import type { ActionFormValues } from './ActionForm'

const columnHelper = createColumnHelper<Action>()

export function ActionsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { page, pageSize, search, isActive, setPage, setPageSize, setSearch, setIsActive } = useListState()

  const [drawerAction, setDrawerAction] = useState<Action | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Action | null>(null)

  const query = useQuery({
    queryKey: ['actions', { page, pageSize, search, isActive }],
    queryFn: () => actionsApi.list({ page, pageSize, search, isActive }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: actionsApi.create,
    onSuccess: () => {
      toast.success('Action created')
      queryClient.invalidateQueries({ queryKey: ['actions'] })
      setDrawerAction(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ActionFormValues }) => actionsApi.update(id, values),
    onSuccess: () => {
      toast.success('Action updated')
      queryClient.invalidateQueries({ queryKey: ['actions'] })
      setDrawerAction(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => actionsApi.remove(id),
    onSuccess: () => {
      toast.success('Action deleted')
      queryClient.invalidateQueries({ queryKey: ['actions'] })
      setDeleteTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('name', {
      header: 'Action',
      cell: (info) => (
        <div>
          <div className="font-medium text-slate-900">{info.getValue()}</div>
          <div className="font-mono text-xs text-slate-400">{info.row.original.code}</div>
        </div>
      ),
    }),
    columnHelper.accessor('sortOrder', { header: 'Sort order' }),
    columnHelper.display({
      id: 'flags',
      header: 'Flags',
      cell: (info) => (info.row.original.isSystem ? <Badge tone="amber">System</Badge> : null),
    }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => <StatusBadge isActive={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <div className="flex justify-end gap-1">
          <IconButton
            label="Edit action"
            onClick={(e) => {
              e.stopPropagation()
              setDrawerAction(info.row.original)
            }}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Delete action"
            variant="danger"
            disabled={info.row.original.isSystem}
            onClick={(e) => {
              e.stopPropagation()
              setDeleteTarget(info.row.original)
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </IconButton>
        </div>
      ),
    }),
  ]

  const formId = 'action-form'
  const isEditing = drawerAction !== null && drawerAction !== 'new'

  return (
    <div>
      <PageHeader
        title="Actions"
        description="Operations that can be performed within a module."
        actions={
          <Button variant="primary" onClick={() => setDrawerAction('new')}>
            <Plus className="size-3.5" aria-hidden="true" />
            New action
          </Button>
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
        searchPlaceholder="Search by name or code…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        onRowClick={(row) => navigate(`/actions/${row.id}`)}
        toolbarExtra={<ActiveFilterSelect value={isActive} onChange={setIsActive} />}
        emptyTitle="No actions found"
        emptyDescription="Create an action to start defining permissions."
      />

      <Drawer
        open={drawerAction !== null}
        onClose={() => setDrawerAction(null)}
        title={isEditing ? 'Edit action' : 'New action'}
        footer={
          <ActionFormFooter
            formId={formId}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawerAction(null)}
          />
        }
      >
        <ActionForm
          formId={formId}
          defaultValues={isEditing ? (drawerAction as Action) : undefined}
          onSubmit={(values) => {
            if (isEditing) updateMutation.mutate({ id: (drawerAction as Action).id, values })
            else createMutation.mutate(values)
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete action"
        description={`Delete "${deleteTarget?.name}"? Permissions using it will be affected.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
