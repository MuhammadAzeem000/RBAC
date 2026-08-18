import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { actionsApi } from '@/api/actions.api'
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
import { ActionForm, ActionFormFooter } from './ActionForm'
import type { ActionFormValues } from './ActionForm'

export function ActionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const query = useQuery({
    queryKey: ['actions', id],
    queryFn: () => actionsApi.get(id),
  })

  const updateMutation = useMutation({
    mutationFn: (values: ActionFormValues) => actionsApi.update(id, values),
    onSuccess: () => {
      toast.success('Action updated')
      queryClient.invalidateQueries({ queryKey: ['actions'] })
      setEditing(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => actionsApi.remove(id),
    onSuccess: () => {
      toast.success('Action deleted')
      queryClient.invalidateQueries({ queryKey: ['actions'] })
      navigate('/actions')
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

  const action = query.data
  const formId = 'action-edit-form'

  return (
    <div>
      <Link to="/actions" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to actions
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{action.name}</h1>
            <StatusBadge isActive={action.isActive} />
            {action.isSystem && <Badge tone="amber">System</Badge>}
          </div>
          <p className="mt-0.5 font-mono text-sm text-slate-500">{action.code}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="danger-ghost" disabled={action.isSystem} onClick={() => setDeleting(true)}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <DescriptionList
            fields={[
              { label: 'Sort order', value: action.sortOrder },
              { label: 'Created', value: new Date(action.createdAt).toLocaleString() },
            ]}
          />
          {action.description && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-400">Description</p>
              <p className="mt-0.5 text-sm text-slate-700">{action.description}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit action"
        footer={
          <ActionFormFooter formId={formId} saving={updateMutation.isPending} onCancel={() => setEditing(false)} />
        }
      >
        <ActionForm formId={formId} defaultValues={action} onSubmit={(values) => updateMutation.mutate(values)} />
      </Drawer>

      <ConfirmDialog
        open={deleting}
        title="Delete action"
        description={`Delete "${action.name}"? Permissions using it will be affected.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}
