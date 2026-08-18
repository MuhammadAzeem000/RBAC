import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { departmentsApi } from '@/api/departments.api'
import { userDepartmentsApi } from '@/api/userAssociations.api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormField } from '@/components/ui/FormField'
import { IconButton } from '@/components/ui/IconButton'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'

interface UserDepartmentsPanelProps {
  userId: string
}

export function UserDepartmentsPanel({ userId }: UserDepartmentsPanelProps) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canManage = can('Users', 'Update')
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)

  const assignedQuery = useQuery({
    queryKey: ['users', userId, 'departments'],
    queryFn: () => userDepartmentsApi.list(userId, { page: 1, pageSize: 100 }),
  })

  const availableDepartmentsQuery = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: () => departmentsApi.list({ page: 1, pageSize: 100, isActive: true }),
    enabled: assignOpen,
  })

  const assignMutation = useMutation({
    mutationFn: () => userDepartmentsApi.assign(userId, selectedDepartmentId, isPrimary),
    onSuccess: () => {
      toast.success('Department assigned')
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'departments'] })
      setAssignOpen(false)
      setSelectedDepartmentId('')
      setIsPrimary(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const revokeMutation = useMutation({
    mutationFn: (departmentId: string) => userDepartmentsApi.revoke(userId, departmentId),
    onSuccess: () => {
      toast.success('Department revoked')
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'departments'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const assigned = assignedQuery.data?.data ?? []
  const assignedIds = new Set(assigned.map((d) => d.id))
  const availableDepartments = (availableDepartmentsQuery.data?.data ?? []).filter(
    (d) => !assignedIds.has(d.id),
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">Departments this user belongs to.</p>
        {canManage && (
          <Button variant="secondary" onClick={() => setAssignOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Assign department
          </Button>
        )}
      </div>

      {assignedQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : assignedQuery.isError ? (
        <ErrorState message={getErrorMessage(assignedQuery.error)} onRetry={() => assignedQuery.refetch()} />
      ) : assigned.length === 0 ? (
        <EmptyState title="No departments assigned" />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {assigned.map((department) => (
            <li key={department.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{department.name}</p>
                {department.code && <p className="text-xs text-slate-400">{department.code}</p>}
              </div>
              <div className="flex items-center gap-2">
                {department.isPrimary && <Badge tone="blue">Primary</Badge>}
                {canManage && (
                  <IconButton
                    label={`Remove ${department.name}`}
                    variant="danger"
                    onClick={() => revokeMutation.mutate(department.id)}
                    disabled={revokeMutation.isPending}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </IconButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign department" size="sm">
        <FormField label="Department">
          {(id) => (
            <Select
              id={id}
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              disabled={availableDepartmentsQuery.isLoading}
            >
              <option value="">Select a department…</option>
              {availableDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Set as primary department
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAssignOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selectedDepartmentId}
            loading={assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            Assign
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
