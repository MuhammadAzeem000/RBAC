import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { modulesApi } from '@/api/modules.api'
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
import { ModuleForm, ModuleFormFooter } from './ModuleForm'
import type { ModuleFormValues } from './ModuleForm'

export function ModuleDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const query = useQuery({
    queryKey: ['modules', id],
    queryFn: () => modulesApi.get(id),
  })

  const updateMutation = useMutation({
    mutationFn: (values: ModuleFormValues) => modulesApi.update(id, values),
    onSuccess: () => {
      toast.success('Module updated')
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      setEditing(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => modulesApi.remove(id),
    onSuccess: () => {
      toast.success('Module deleted')
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      navigate('/modules')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: (nextIsActive: boolean) => modulesApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, nextIsActive) => {
      toast.success(nextIsActive ? 'Module activated' : 'Module deactivated')
      queryClient.invalidateQueries({ queryKey: ['modules'] })
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

  const appModule = query.data
  const formId = 'module-edit-form'

  return (
    <div>
      <Link to="/modules" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to modules
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{appModule.name}</h1>
            <StatusBadge isActive={appModule.isActive} />
            {appModule.isSystem && <Badge tone="amber">System</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {appModule.isActive ? (
            <Button
              variant="secondary"
              disabled={appModule.isSystem}
              title={appModule.isSystem ? "System modules can't be deactivated" : undefined}
              onClick={() => setDeactivating(true)}
            >
              <PowerOff className="size-3.5" aria-hidden="true" />
              Deactivate
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={appModule.isSystem}
              title={appModule.isSystem ? "System modules can't be deactivated" : undefined}
              onClick={() => setActiveMutation.mutate(true)}
              loading={setActiveMutation.isPending}
            >
              <Power className="size-3.5" aria-hidden="true" />
              Activate
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="danger-ghost" disabled={appModule.isSystem} onClick={() => setDeleting(true)}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <DescriptionList
            fields={[
              { label: 'Route', value: appModule.route },
              { label: 'Icon', value: appModule.icon },
              { label: 'Sort order', value: appModule.sortOrder },
              { label: 'Created', value: new Date(appModule.createdAt).toLocaleString() },
            ]}
          />
          {appModule.description && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-400">Description</p>
              <p className="mt-0.5 text-sm text-slate-700">{appModule.description}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit module"
        footer={
          <ModuleFormFooter formId={formId} saving={updateMutation.isPending} onCancel={() => setEditing(false)} />
        }
      >
        <ModuleForm formId={formId} defaultValues={appModule} onSubmit={(values) => updateMutation.mutate(values)} />
      </Drawer>

      <ConfirmDialog
        open={deleting}
        title="Delete module"
        description={`Delete "${appModule.name}"? Permissions scoped to it will be affected.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleting(false)}
      />

      <ConfirmDialog
        open={deactivating}
        title="Deactivate module"
        description={`Deactivate "${appModule.name}"? Permissions scoped to it will no longer be usable until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => setActiveMutation.mutate(false)}
        onCancel={() => setDeactivating(false)}
      />
    </div>
  )
}
