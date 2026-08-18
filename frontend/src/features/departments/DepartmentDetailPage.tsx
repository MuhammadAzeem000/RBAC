import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { departmentsApi } from '@/api/departments.api'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { useMyDepartmentIds } from '@/hooks/useCurrentUserAssignments'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import { DepartmentForm, DepartmentFormFooter } from './DepartmentForm'
import type { DepartmentFormValues } from './DepartmentForm'

export function DepartmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const myDepartmentIds = useMyDepartmentIds()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const query = useQuery({
    queryKey: ['departments', id],
    queryFn: () => departmentsApi.get(id),
  })

  const updateMutation = useMutation({
    mutationFn: (values: DepartmentFormValues) => departmentsApi.update(id, values),
    onSuccess: () => {
      toast.success('Department updated')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setEditing(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => departmentsApi.remove(id),
    onSuccess: () => {
      toast.success('Department deleted')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      navigate('/departments')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: (nextIsActive: boolean) => departmentsApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, nextIsActive) => {
      toast.success(nextIsActive ? 'Department activated' : 'Department deactivated')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
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

  const department = query.data
  const formId = 'department-edit-form'
  const isMine = myDepartmentIds.has(department.id)

  return (
    <div>
      <Link
        to="/departments"
        className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to departments
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{department.name}</h1>
            <StatusBadge isActive={department.isActive} />
          </div>
          {department.code && <p className="mt-0.5 text-sm text-slate-500">{department.code}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {department.isActive ? (
            <Button
              variant="secondary"
              disabled={isMine}
              title={isMine ? "You can't change the active status of a department you belong to" : undefined}
              onClick={() => setDeactivating(true)}
            >
              <PowerOff className="size-3.5" aria-hidden="true" />
              Deactivate
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={isMine}
              title={isMine ? "You can't change the active status of a department you belong to" : undefined}
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
          <Button
            variant="danger-ghost"
            disabled={isMine}
            title={isMine ? "You can't delete a department you belong to" : undefined}
            onClick={() => setDeleting(true)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      {isMine && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          You belong to this department, so it can't be deleted or have its active status changed from here.
        </p>
      )}

      <Card>
        <CardBody>
          <DescriptionList
            fields={[
              { label: 'Sort order', value: department.sortOrder },
              { label: 'Status', value: department.status },
              { label: 'Created', value: new Date(department.createdAt).toLocaleString() },
            ]}
          />
          {department.description && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-400">Description</p>
              <p className="mt-0.5 text-sm text-slate-700">{department.description}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <Drawer
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit department"
        footer={
          <DepartmentFormFooter
            formId={formId}
            saving={updateMutation.isPending}
            onCancel={() => setEditing(false)}
          />
        }
      >
        <DepartmentForm
          formId={formId}
          defaultValues={department}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      </Drawer>

      <ConfirmDialog
        open={deleting}
        title="Delete department"
        description={`Delete "${department.name}"? Users assigned to it will be unassigned.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleting(false)}
      />

      <ConfirmDialog
        open={deactivating}
        title="Deactivate department"
        description={`Deactivate "${department.name}"? It will no longer be usable until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => setActiveMutation.mutate(false)}
        onCancel={() => setDeactivating(false)}
      />
    </div>
  )
}
