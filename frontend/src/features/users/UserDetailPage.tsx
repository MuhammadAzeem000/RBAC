import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usersApi } from '@/api/users.api'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs } from '@/components/ui/Tabs'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import { UserDepartmentsPanel } from './UserDepartmentsPanel'
import { UserForm, UserFormFooter } from './UserForm'
import type { UserFormValues } from './UserForm'
import { UserRolesPanel } from './UserRolesPanel'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'roles', label: 'Roles' },
  { key: 'departments', label: 'Departments' },
]

export function UserDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const query = useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.get(id),
  })

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      const { password, ...rest } = values
      return usersApi.update(id, password ? { ...rest, password } : rest)
    },
    onSuccess: () => {
      toast.success('User updated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditing(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.remove(id),
    onSuccess: () => {
      toast.success('User deleted')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      navigate('/users')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: (nextIsActive: boolean) => usersApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, nextIsActive) => {
      toast.success(nextIsActive ? 'User activated' : 'User deactivated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeactivating(false)
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

  const user = query.data
  const formId = 'user-edit-form'
  const isSelf = user.id === currentUserId

  return (
    <div>
      <Link to="/users" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to users
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{user.name}</h1>
            <StatusBadge isActive={user.isActive} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            @{user.username} · {user.email}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {user.isActive ? (
            <Button
              variant="secondary"
              disabled={isSelf}
              title={isSelf ? "You can't deactivate your own account" : undefined}
              onClick={() => setDeactivating(true)}
            >
              <UserX className="size-3.5" aria-hidden="true" />
              Deactivate
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={isSelf}
              title={isSelf ? "You can't activate your own account" : undefined}
              onClick={() => setActiveMutation.mutate(true)}
              loading={setActiveMutation.isPending}
            >
              <UserCheck className="size-3.5" aria-hidden="true" />
              Activate
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button
            variant="danger-ghost"
            disabled={isSelf}
            title={isSelf ? "You can't delete your own account" : undefined}
            onClick={() => setDeleting(true)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      {isSelf && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This is your own account, so it can't be deleted or have its active status changed from here.
        </p>
      )}

      <Tabs items={TABS} active={tab} onChange={setTab} />

      <div className="pt-4">
        {tab === 'overview' && (
          <Card>
            <CardBody>
              <DescriptionList
                fields={[
                  { label: 'Job title', value: user.jobTitle },
                  { label: 'Employee code', value: user.employeeCode },
                  { label: 'Phone', value: user.phone },
                  { label: 'Status', value: user.status },
                  { label: 'Verified', value: user.isVerified ? 'Yes' : 'No' },
                  { label: 'Last login', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : null },
                  { label: 'Timezone', value: user.timezone },
                  { label: 'Locale', value: user.locale },
                  { label: 'Created', value: new Date(user.createdAt).toLocaleString() },
                ]}
              />
            </CardBody>
          </Card>
        )}
        {tab === 'roles' && (
          <Card>
            <CardBody>
              <UserRolesPanel userId={user.id} />
            </CardBody>
          </Card>
        )}
        {tab === 'departments' && (
          <Card>
            <CardBody>
              <UserDepartmentsPanel userId={user.id} />
            </CardBody>
          </Card>
        )}
      </div>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit user"
        footer={
          <UserFormFooter formId={formId} saving={updateMutation.isPending} onCancel={() => setEditing(false)} />
        }
      >
        <UserForm
          formId={formId}
          mode="edit"
          defaultValues={user}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      </Drawer>

      <ConfirmDialog
        open={deleting}
        title="Delete user"
        description={`Delete "${user.name}"? They will lose access immediately.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleting(false)}
      />

      <ConfirmDialog
        open={deactivating}
        title="Deactivate user"
        description={`Deactivate "${user.name}"? They won't be able to sign in until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => setActiveMutation.mutate(false)}
        onCancel={() => setDeactivating(false)}
      />
    </div>
  )
}
