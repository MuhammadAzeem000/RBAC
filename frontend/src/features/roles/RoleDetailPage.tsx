import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { rolesApi } from '@/api/roles.api'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs } from '@/components/ui/Tabs'
import { useMyRoleIds } from '@/hooks/useCurrentUserAssignments'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import { RoleForm, RoleFormFooter } from './RoleForm'
import type { RoleFormValues } from './RoleForm'
import { RolePermissionsPanel } from './RolePermissionsPanel'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'permissions', label: 'Permissions' },
]

export function RoleDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const myRoleIds = useMyRoleIds()
  const { can } = useMyPermissions()
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const query = useQuery({
    queryKey: ['roles', id],
    queryFn: () => rolesApi.get(id),
  })

  const updateMutation = useMutation({
    mutationFn: (values: RoleFormValues) => rolesApi.update(id, values),
    onSuccess: () => {
      toast.success('Role updated')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setEditing(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => rolesApi.remove(id),
    onSuccess: () => {
      toast.success('Role deleted')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      navigate('/roles')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: (nextIsActive: boolean) => rolesApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, nextIsActive) => {
      toast.success(nextIsActive ? 'Role activated' : 'Role deactivated')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
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

  const role = query.data
  const formId = 'role-edit-form'
  const isMine = myRoleIds.has(role.id)
  const disableDelete = role.isSystem || isMine
  const deleteTitle = role.isSystem
    ? "System roles can't be deleted"
    : isMine
      ? "You can't delete a role assigned to you"
      : undefined
  const disableActiveToggle = role.isSystem || isMine
  const activeToggleTitle = role.isSystem
    ? "System roles can't be deactivated"
    : isMine
      ? "You can't change the active status of a role assigned to you"
      : undefined

  return (
    <div>
      <Link to="/roles" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to roles
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{role.name}</h1>
            <StatusBadge isActive={role.isActive} />
            {role.isSystem && <Badge tone="amber">System</Badge>}
            {role.isDefault && <Badge tone="blue">Default</Badge>}
          </div>
          {role.code && <p className="mt-0.5 text-sm text-slate-500">{role.code}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {can('Roles', 'Update') &&
            (role.isActive ? (
              <Button
                variant="secondary"
                disabled={disableActiveToggle}
                title={activeToggleTitle}
                onClick={() => setDeactivating(true)}
              >
                <PowerOff className="size-3.5" aria-hidden="true" />
                Deactivate
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={disableActiveToggle}
                title={activeToggleTitle}
                onClick={() => setActiveMutation.mutate(true)}
                loading={setActiveMutation.isPending}
              >
                <Power className="size-3.5" aria-hidden="true" />
                Activate
              </Button>
            ))}
          {can('Roles', 'Update') && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          )}
          {can('Roles', 'Delete') && (
            <Button
              variant="danger-ghost"
              disabled={disableDelete}
              title={deleteTitle}
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {isMine && !role.isSystem && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This role is assigned to your account, so it can't be deleted or have its active status changed from
          here.
        </p>
      )}

      <Tabs items={TABS} active={tab} onChange={setTab} />

      <div className="pt-4">
        {tab === 'overview' && (
          <Card>
            <CardBody>
              <DescriptionList
                fields={[
                  { label: 'Priority', value: role.priority },
                  { label: 'Default for new users', value: role.isDefault ? 'Yes' : 'No' },
                  { label: 'Created', value: new Date(role.createdAt).toLocaleString() },
                ]}
              />
              {role.description && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-400">Description</p>
                  <p className="mt-0.5 text-sm text-slate-700">{role.description}</p>
                </div>
              )}
            </CardBody>
          </Card>
        )}
        {tab === 'permissions' && (
          <Card>
            <CardBody>
              <RolePermissionsPanel roleId={role.id} />
            </CardBody>
          </Card>
        )}
      </div>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit role"
        footer={
          <RoleFormFooter formId={formId} saving={updateMutation.isPending} onCancel={() => setEditing(false)} />
        }
      >
        <RoleForm formId={formId} defaultValues={role} onSubmit={(values) => updateMutation.mutate(values)} />
      </Drawer>

      <ConfirmDialog
        open={deleting}
        title="Delete role"
        description={`Delete "${role.name}"? Users assigned this role will lose its permissions.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleting(false)}
      />

      <ConfirmDialog
        open={deactivating}
        title="Deactivate role"
        description={`Deactivate "${role.name}"? Users with this role will lose its permissions until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => setActiveMutation.mutate(false)}
        onCancel={() => setDeactivating(false)}
      />
    </div>
  )
}
