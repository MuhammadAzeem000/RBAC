import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { actionsApi } from '@/api/actions.api'
import { modulesApi } from '@/api/modules.api'
import { permissionsApi } from '@/api/permissions.api'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import { PermissionForm, PermissionFormFooter } from './PermissionForm'
import type { PermissionFormValues } from './PermissionForm'

export function PermissionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const query = useQuery({
    queryKey: ['permissions', id],
    queryFn: () => permissionsApi.get(id),
  })

  const moduleQuery = useQuery({
    queryKey: ['modules', query.data?.moduleId],
    queryFn: () => modulesApi.get(query.data!.moduleId),
    enabled: Boolean(query.data),
  })
  const actionQuery = useQuery({
    queryKey: ['actions', query.data?.actionId],
    queryFn: () => actionsApi.get(query.data!.actionId),
    enabled: Boolean(query.data),
  })

  const updateMutation = useMutation({
    mutationFn: (values: PermissionFormValues) => permissionsApi.update(id, values),
    onSuccess: () => {
      toast.success('Permission updated')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setEditing(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => permissionsApi.remove(id),
    onSuccess: () => {
      toast.success('Permission deleted')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      navigate('/permissions')
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

  const permission = query.data
  const formId = 'permission-edit-form'

  return (
    <div>
      <Link
        to="/permissions"
        className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to permissions
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{permission.name}</h1>
            <StatusBadge isActive={permission.isActive} />
            {permission.isSystem && <Badge tone="amber">System</Badge>}
          </div>
          <p className="mt-0.5 font-mono text-sm text-slate-500">{permission.code}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="danger-ghost" disabled={permission.isSystem} onClick={() => setDeleting(true)}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <DescriptionList
            fields={[
              { label: 'Module', value: moduleQuery.data?.name },
              { label: 'Action', value: actionQuery.data?.name },
              { label: 'Created', value: new Date(permission.createdAt).toLocaleString() },
            ]}
          />
          {permission.description && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-400">Description</p>
              <p className="mt-0.5 text-sm text-slate-700">{permission.description}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit permission"
        footer={
          <PermissionFormFooter
            formId={formId}
            saving={updateMutation.isPending}
            onCancel={() => setEditing(false)}
          />
        }
      >
        <PermissionForm
          formId={formId}
          mode="edit"
          defaultValues={permission}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      </Drawer>

      <ConfirmDialog
        open={deleting}
        title="Delete permission"
        description={`Delete "${permission.name}"? Roles granting it will lose this access.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}
