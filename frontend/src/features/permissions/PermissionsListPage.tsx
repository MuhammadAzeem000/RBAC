import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { actionsApi } from '@/api/actions.api'
import { modulesApi } from '@/api/modules.api'
import { permissionsApi } from '@/api/permissions.api'
import { ActiveFilterSelect } from '@/components/ui/ActiveFilterSelect'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useListState } from '@/hooks/useListState'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { Permission } from '@/types/permission'
import { PermissionForm, PermissionFormFooter } from './PermissionForm'
import type { PermissionFormValues } from './PermissionForm'

const columnHelper = createColumnHelper<Permission>()

export function PermissionsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { page, pageSize, search, isActive, setPage, setPageSize, setSearch, setIsActive } = useListState()
  const [moduleFilter, setModuleFilter] = useState('')

  const [drawerPermission, setDrawerPermission] = useState<Permission | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Permission | null>(null)

  const modulesQuery = useQuery({
    queryKey: ['modules', 'all'],
    queryFn: () => modulesApi.list({ page: 1, pageSize: 100 }),
  })
  const actionsQuery = useQuery({
    queryKey: ['actions', 'all'],
    queryFn: () => actionsApi.list({ page: 1, pageSize: 100 }),
  })

  const moduleNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const module of modulesQuery.data?.data ?? []) map.set(module.id, module.name)
    return map
  }, [modulesQuery.data])

  const actionNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const action of actionsQuery.data?.data ?? []) map.set(action.id, action.name)
    return map
  }, [actionsQuery.data])

  const query = useQuery({
    queryKey: ['permissions', { page, pageSize, search, isActive, moduleFilter }],
    queryFn: () =>
      permissionsApi.list({ page, pageSize, search, isActive, moduleId: moduleFilter || undefined }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: (values: PermissionFormValues) => permissionsApi.create(values),
    onSuccess: () => {
      toast.success('Permission created')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setDrawerPermission(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: PermissionFormValues }) =>
      permissionsApi.update(id, values),
    onSuccess: () => {
      toast.success('Permission updated')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setDrawerPermission(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => permissionsApi.remove(id),
    onSuccess: () => {
      toast.success('Permission deleted')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setDeleteTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('name', {
      header: 'Permission',
      cell: (info) => (
        <div>
          <div className="font-medium text-slate-900">{info.getValue()}</div>
          <div className="font-mono text-xs text-slate-400">{info.row.original.code}</div>
        </div>
      ),
    }),
    columnHelper.accessor('moduleId', {
      header: 'Module',
      cell: (info) => moduleNames.get(info.getValue()) ?? '—',
    }),
    columnHelper.accessor('actionId', {
      header: 'Action',
      cell: (info) => actionNames.get(info.getValue()) ?? '—',
    }),
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
            label="Edit permission"
            onClick={(e) => {
              e.stopPropagation()
              setDrawerPermission(info.row.original)
            }}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Delete permission"
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

  const formId = 'permission-form'
  const isEditing = drawerPermission !== null && drawerPermission !== 'new'

  return (
    <div>
      <PageHeader
        title="Permissions"
        description="Fine-grained access grants, scoped to a module and action."
        actions={
          <Button variant="primary" onClick={() => setDrawerPermission('new')}>
            <Plus className="size-3.5" aria-hidden="true" />
            New permission
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
        onRowClick={(row) => navigate(`/permissions/${row.id}`)}
        toolbarExtra={
          <>
            <Select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              aria-label="Filter by module"
              className="h-8! w-auto"
            >
              <option value="">All modules</option>
              {modulesQuery.data?.data.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.name}
                </option>
              ))}
            </Select>
            <ActiveFilterSelect value={isActive} onChange={setIsActive} />
          </>
        }
        emptyTitle="No permissions found"
        emptyDescription="Create a permission to grant access to a module action."
      />

      <Drawer
        open={drawerPermission !== null}
        onClose={() => setDrawerPermission(null)}
        title={isEditing ? 'Edit permission' : 'New permission'}
        footer={
          <PermissionFormFooter
            formId={formId}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawerPermission(null)}
          />
        }
      >
        <PermissionForm
          formId={formId}
          mode={isEditing ? 'edit' : 'create'}
          defaultValues={isEditing ? (drawerPermission as Permission) : undefined}
          onSubmit={(values) => {
            if (isEditing) updateMutation.mutate({ id: (drawerPermission as Permission).id, values })
            else createMutation.mutate(values)
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete permission"
        description={`Delete "${deleteTarget?.name}"? Roles granting it will lose this access.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
