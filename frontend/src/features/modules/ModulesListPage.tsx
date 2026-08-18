import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { modulesApi } from '@/api/modules.api'
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
import type { AppModule } from '@/types/module'
import { ModuleForm, ModuleFormFooter } from './ModuleForm'
import type { ModuleFormValues } from './ModuleForm'

const columnHelper = createColumnHelper<AppModule>()

export function ModulesListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { page, pageSize, search, isActive, setPage, setPageSize, setSearch, setIsActive } = useListState()

  const [drawerModule, setDrawerModule] = useState<AppModule | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppModule | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AppModule | null>(null)

  const query = useQuery({
    queryKey: ['modules', { page, pageSize, search, isActive }],
    queryFn: () => modulesApi.list({ page, pageSize, search, isActive }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: modulesApi.create,
    onSuccess: () => {
      toast.success('Module created')
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      setDrawerModule(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ModuleFormValues }) => modulesApi.update(id, values),
    onSuccess: () => {
      toast.success('Module updated')
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      setDrawerModule(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => modulesApi.remove(id),
    onSuccess: () => {
      toast.success('Module deleted')
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      setDeleteTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive: nextIsActive }: { id: string; isActive: boolean }) =>
      modulesApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? 'Module activated' : 'Module deactivated')
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      setDeactivateTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('name', {
      header: 'Module',
      cell: (info) => <div className="font-medium text-slate-900">{info.getValue()}</div>,
    }),
    columnHelper.accessor('route', { header: 'Route', cell: (info) => info.getValue() ?? '—' }),
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
      cell: (info) => {
        const appModule = info.row.original
        const activeToggleLabel = appModule.isSystem
          ? "System modules can't be deactivated"
          : appModule.isActive
            ? 'Deactivate module'
            : 'Activate module'
        return (
          <div className="flex justify-end gap-1">
            {appModule.isActive ? (
              <IconButton
                label={activeToggleLabel}
                variant="danger"
                disabled={appModule.isSystem}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeactivateTarget(appModule)
                }}
              >
                <PowerOff className="size-3.5" aria-hidden="true" />
              </IconButton>
            ) : (
              <IconButton
                label={activeToggleLabel}
                disabled={appModule.isSystem || setActiveMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveMutation.mutate({ id: appModule.id, isActive: true })
                }}
              >
                <Power className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
            <IconButton
              label="Edit module"
              onClick={(e) => {
                e.stopPropagation()
                setDrawerModule(appModule)
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Delete module"
              variant="danger"
              disabled={appModule.isSystem}
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(appModule)
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </IconButton>
          </div>
        )
      },
    }),
  ]

  const formId = 'module-form'
  const isEditing = drawerModule !== null && drawerModule !== 'new'

  return (
    <div>
      <PageHeader
        title="Modules"
        description="Feature areas that permissions can be scoped to."
        actions={
          <Button variant="primary" onClick={() => setDrawerModule('new')}>
            <Plus className="size-3.5" aria-hidden="true" />
            New module
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
        searchPlaceholder="Search by name…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        onRowClick={(row) => navigate(`/modules/${row.id}`)}
        toolbarExtra={<ActiveFilterSelect value={isActive} onChange={setIsActive} />}
        emptyTitle="No modules found"
        emptyDescription="Create a module to start defining permissions."
      />

      <Drawer
        open={drawerModule !== null}
        onClose={() => setDrawerModule(null)}
        title={isEditing ? 'Edit module' : 'New module'}
        footer={
          <ModuleFormFooter
            formId={formId}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawerModule(null)}
          />
        }
      >
        <ModuleForm
          formId={formId}
          defaultValues={isEditing ? (drawerModule as AppModule) : undefined}
          onSubmit={(values) => {
            if (isEditing) updateMutation.mutate({ id: (drawerModule as AppModule).id, values })
            else createMutation.mutate(values)
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete module"
        description={`Delete "${deleteTarget?.name}"? Permissions scoped to it will be affected.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate module"
        description={`Deactivate "${deactivateTarget?.name}"? Permissions scoped to it will no longer be usable until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => deactivateTarget && setActiveMutation.mutate({ id: deactivateTarget.id, isActive: false })}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
