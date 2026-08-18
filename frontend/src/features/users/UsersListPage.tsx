import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersApi } from '@/api/users.api'
import { ActiveFilterSelect } from '@/components/ui/ActiveFilterSelect'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/Badge'
import { useListState } from '@/hooks/useListState'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import type { User } from '@/types/user'
import { UserForm, UserFormFooter } from './UserForm'
import type { UserFormValues } from './UserForm'

const columnHelper = createColumnHelper<User>()

export function UsersListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const { page, pageSize, search, isActive, setPage, setPageSize, setSearch, setIsActive } = useListState()

  const [drawerUser, setDrawerUser] = useState<User | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null)

  const query = useQuery({
    queryKey: ['users', { page, pageSize, search, isActive }],
    queryFn: () => usersApi.list({ page, pageSize, search, isActive }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) => usersApi.create(values),
    onSuccess: () => {
      toast.success('User created')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDrawerUser(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserFormValues }) => {
      const { password, ...rest } = values
      return usersApi.update(id, password ? { ...rest, password } : rest)
    },
    onSuccess: () => {
      toast.success('User updated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDrawerUser(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success('User deleted')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive: nextIsActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? 'User activated' : 'User deactivated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeactivateTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('name', {
      header: 'User',
      cell: (info) => (
        <div>
          <div className="font-medium text-slate-900">{info.getValue()}</div>
          <div className="text-xs text-slate-400">@{info.row.original.username}</div>
        </div>
      ),
    }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('jobTitle', { header: 'Job title', cell: (info) => info.getValue() ?? '—' }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => <StatusBadge isActive={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const user = info.row.original
        const isSelf = user.id === currentUserId
        return (
          <div className="flex justify-end gap-1">
            {user.isActive ? (
              <IconButton
                label={isSelf ? "You can't deactivate your own account" : 'Deactivate user'}
                variant="danger"
                disabled={isSelf}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeactivateTarget(user)
                }}
              >
                <UserX className="size-3.5" aria-hidden="true" />
              </IconButton>
            ) : (
              <IconButton
                label={isSelf ? "You can't activate your own account" : 'Activate user'}
                disabled={isSelf || setActiveMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveMutation.mutate({ id: user.id, isActive: true })
                }}
              >
                <UserCheck className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
            <IconButton
              label="Edit user"
              onClick={(e) => {
                e.stopPropagation()
                setDrawerUser(user)
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton
              label={isSelf ? "You can't delete your own account" : 'Delete user'}
              variant="danger"
              disabled={isSelf}
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(user)
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </IconButton>
          </div>
        )
      },
    }),
  ]

  const formId = 'user-form'
  const isEditing = drawerUser !== null && drawerUser !== 'new'

  return (
    <div>
      <PageHeader
        title="Users"
        description="People with access to your organization."
        actions={
          <Button variant="primary" onClick={() => setDrawerUser('new')}>
            <Plus className="size-3.5" aria-hidden="true" />
            New user
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
        searchPlaceholder="Search by name, username, or email…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        toolbarExtra={<ActiveFilterSelect value={isActive} onChange={setIsActive} />}
        emptyTitle="No users found"
        emptyDescription="Invite a user to get started."
      />

      <Drawer
        open={drawerUser !== null}
        onClose={() => setDrawerUser(null)}
        title={isEditing ? 'Edit user' : 'New user'}
        footer={
          <UserFormFooter
            formId={formId}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawerUser(null)}
          />
        }
      >
        <UserForm
          formId={formId}
          mode={isEditing ? 'edit' : 'create'}
          defaultValues={isEditing ? (drawerUser as User) : undefined}
          onSubmit={(values) => {
            if (isEditing) updateMutation.mutate({ id: (drawerUser as User).id, values })
            else createMutation.mutate(values)
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user"
        description={`Delete "${deleteTarget?.name}"? They will lose access immediately.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate user"
        description={`Deactivate "${deactivateTarget?.name}"? They won't be able to sign in until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => deactivateTarget && setActiveMutation.mutate({ id: deactivateTarget.id, isActive: false })}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
