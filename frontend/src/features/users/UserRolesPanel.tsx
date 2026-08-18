import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { rolesApi } from '@/api/roles.api'
import { userRolesApi } from '@/api/userAssociations.api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormField } from '@/components/ui/FormField'
import { IconButton } from '@/components/ui/IconButton'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'

interface UserRolesPanelProps {
  userId: string
}

export function UserRolesPanel({ userId }: UserRolesPanelProps) {
  const queryClient = useQueryClient()
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')

  const assignedQuery = useQuery({
    queryKey: ['users', userId, 'roles'],
    queryFn: () => userRolesApi.list(userId, { page: 1, pageSize: 100 }),
  })

  const availableRolesQuery = useQuery({
    queryKey: ['roles', 'all'],
    queryFn: () => rolesApi.list({ page: 1, pageSize: 100, isActive: true }),
    enabled: assignOpen,
  })

  const assignMutation = useMutation({
    mutationFn: (roleId: string) => userRolesApi.assign(userId, roleId),
    onSuccess: () => {
      toast.success('Role assigned')
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'roles'] })
      setAssignOpen(false)
      setSelectedRoleId('')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const revokeMutation = useMutation({
    mutationFn: (roleId: string) => userRolesApi.revoke(userId, roleId),
    onSuccess: () => {
      toast.success('Role revoked')
      queryClient.invalidateQueries({ queryKey: ['users', userId, 'roles'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const assigned = assignedQuery.data?.data ?? []
  const assignedIds = new Set(assigned.map((r) => r.id))
  const availableRoles = (availableRolesQuery.data?.data ?? []).filter((r) => !assignedIds.has(r.id))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">Roles determine which permissions this user inherits.</p>
        <Button variant="secondary" onClick={() => setAssignOpen(true)}>
          <Plus className="size-3.5" aria-hidden="true" />
          Assign role
        </Button>
      </div>

      {assignedQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : assignedQuery.isError ? (
        <ErrorState message={getErrorMessage(assignedQuery.error)} onRetry={() => assignedQuery.refetch()} />
      ) : assigned.length === 0 ? (
        <EmptyState title="No roles assigned" description="Assign a role to grant this user permissions." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {assigned.map((role) => (
            <li key={role.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{role.name}</p>
                {role.code && <p className="text-xs text-slate-400">{role.code}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="blue">Priority {role.priority}</Badge>
                <IconButton
                  label={`Revoke ${role.name}`}
                  variant="danger"
                  onClick={() => revokeMutation.mutate(role.id)}
                  disabled={revokeMutation.isPending}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign role" size="sm">
        <FormField label="Role">
          {(id) => (
            <Select
              id={id}
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={availableRolesQuery.isLoading}
            >
              <option value="">Select a role…</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAssignOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selectedRoleId}
            loading={assignMutation.isPending}
            onClick={() => assignMutation.mutate(selectedRoleId)}
          >
            Assign
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
