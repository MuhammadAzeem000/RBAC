import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { rolesApi } from '@/api/roles.api'
import { ActiveFilterSelect } from '@/components/ui/ActiveFilterSelect'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { useMyRoleIds } from '@/hooks/useCurrentUserAssignments'
import { useListState } from '@/hooks/useListState'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { Role } from '@/types/role'
import { RoleForm, RoleFormFooter } from './RoleForm'
import type { RoleFormValues } from './RoleForm'

const columnHelper = createColumnHelper<Role>()

export function RolesListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const myRoleIds = useMyRoleIds()
  const { page, pageSize, search, isActive, setPage, setPageSize, setSearch, setIsActive } = useListState()

  const [drawerRole, setDrawerRole] = useState<Role | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Role | null>(null)

  const query = useQuery({
    queryKey: ['roles', { page, pageSize, search, isActive }],
    queryFn: () => rolesApi.list({ page, pageSize, search, isActive }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: (values: RoleFormValues) => rolesApi.create(values),
    onSuccess: () => {
      toast.success('Role created')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setDrawerRole(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: RoleFormValues }) => rolesApi.update(id, values),
    onSuccess: () => {
      toast.success('Role updated')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setDrawerRole(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      toast.success('Role deleted')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setDeleteTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive: nextIsActive }: { id: string; isActive: boolean }) =>
      rolesApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? 'Role activated' : 'Role deactivated')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setDeactivateTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('name', {
      header: 'Role',
      cell: (info) => (
        <div>
          <div className="font-medium text-slate-900">{info.getValue()}</div>
          {info.row.original.code && <div className="text-xs text-slate-400">{info.row.original.code}</div>}
        </div>
      ),
    }),
    columnHelper.accessor('priority', { header: 'Priority' }),
    columnHelper.display({
      id: 'flags',
      header: 'Flags',
      cell: (info) => (
        <div className="flex gap-1">
          {info.row.original.isSystem && <Badge tone="amber">System</Badge>}
          {info.row.original.isDefault && <Badge tone="blue">Default</Badge>}
        </div>
      ),
    }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => <StatusBadge isActive={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const role = info.row.original
        const isMine = myRoleIds.has(role.id)
        const disableDelete = role.isSystem || isMine
        const deleteLabel = role.isSystem
          ? "System roles can't be deleted"
          : isMine
            ? "You can't delete a role assigned to you"
            : 'Delete role'
        const disableActiveToggle = role.isSystem || isMine
        const activeToggleLabel = role.isSystem
          ? "System roles can't be deactivated"
          : isMine
            ? "You can't change the active status of a role assigned to you"
            : undefined
        return (
          <div className="flex justify-end gap-1">
            {role.isActive ? (
              <IconButton
                label={activeToggleLabel ?? 'Deactivate role'}
                variant="danger"
                disabled={disableActiveToggle}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeactivateTarget(role)
                }}
              >
                <PowerOff className="size-3.5" aria-hidden="true" />
              </IconButton>
            ) : (
              <IconButton
                label={activeToggleLabel ?? 'Activate role'}
                disabled={disableActiveToggle || setActiveMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveMutation.mutate({ id: role.id, isActive: true })
                }}
              >
                <Power className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
            <IconButton
              label="Edit role"
              onClick={(e) => {
                e.stopPropagation()
                setDrawerRole(role)
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton
              label={deleteLabel}
              variant="danger"
              disabled={disableDelete}
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(role)
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </IconButton>
          </div>
        )
      },
    }),
  ]

  const formId = 'role-form'
  const isEditing = drawerRole !== null && drawerRole !== 'new'

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Bundles of permissions you can assign to users."
        actions={
          <Button variant="primary" onClick={() => setDrawerRole('new')}>
            <Plus className="size-3.5" aria-hidden="true" />
            New role
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
        onRowClick={(row) => navigate(`/roles/${row.id}`)}
        toolbarExtra={<ActiveFilterSelect value={isActive} onChange={setIsActive} />}
        emptyTitle="No roles found"
        emptyDescription="Create a role to start assigning permissions."
      />

      <Drawer
        open={drawerRole !== null}
        onClose={() => setDrawerRole(null)}
        title={isEditing ? 'Edit role' : 'New role'}
        footer={
          <RoleFormFooter
            formId={formId}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawerRole(null)}
          />
        }
      >
        <RoleForm
          formId={formId}
          defaultValues={isEditing ? (drawerRole as Role) : undefined}
          onSubmit={(values) => {
            if (isEditing) updateMutation.mutate({ id: (drawerRole as Role).id, values })
            else createMutation.mutate(values)
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete role"
        description={`Delete "${deleteTarget?.name}"? Users assigned this role will lose its permissions.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate role"
        description={`Deactivate "${deactivateTarget?.name}"? Users with this role will lose its permissions until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => deactivateTarget && setActiveMutation.mutate({ id: deactivateTarget.id, isActive: false })}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
