import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { permissionsApi } from '@/api/permissions.api'
import { rolesApi } from '@/api/roles.api'
import { Button } from '@/components/ui/Button'
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

interface RolePermissionsPanelProps {
  roleId: string
}

export function RolePermissionsPanel({ roleId }: RolePermissionsPanelProps) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canManage = can('Roles', 'Update')
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedPermissionId, setSelectedPermissionId] = useState('')

  const assignedQuery = useQuery({
    queryKey: ['roles', roleId, 'permissions'],
    queryFn: () => rolesApi.listPermissions(roleId, { page: 1, pageSize: 100 }),
  })

  const availablePermissionsQuery = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => permissionsApi.list({ page: 1, pageSize: 100, isActive: true }),
    enabled: assignOpen,
  })

  const assignMutation = useMutation({
    mutationFn: (permissionId: string) => rolesApi.assignPermission(roleId, permissionId),
    onSuccess: () => {
      toast.success('Permission assigned')
      queryClient.invalidateQueries({ queryKey: ['roles', roleId, 'permissions'] })
      setAssignOpen(false)
      setSelectedPermissionId('')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const revokeMutation = useMutation({
    mutationFn: (permissionId: string) => rolesApi.revokePermission(roleId, permissionId),
    onSuccess: () => {
      toast.success('Permission revoked')
      queryClient.invalidateQueries({ queryKey: ['roles', roleId, 'permissions'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const assigned = assignedQuery.data?.data ?? []
  const assignedIds = new Set(assigned.map((p) => p.id))
  const availablePermissions = (availablePermissionsQuery.data?.data ?? []).filter(
    (p) => !assignedIds.has(p.id),
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">Permissions granted to users with this role.</p>
        {canManage && (
          <Button variant="secondary" onClick={() => setAssignOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Assign permission
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
        <EmptyState title="No permissions assigned" description="Assign a permission to grant access." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {assigned.map((permission) => (
            <li key={permission.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <p className="text-sm font-medium text-slate-800">{permission.name}</p>
              {canManage && (
                <IconButton
                  label={`Revoke ${permission.name}`}
                  variant="danger"
                  onClick={() => revokeMutation.mutate(permission.id)}
                  disabled={revokeMutation.isPending}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign permission" size="sm">
        <FormField label="Permission">
          {(id) => (
            <Select
              id={id}
              value={selectedPermissionId}
              onChange={(e) => setSelectedPermissionId(e.target.value)}
              disabled={availablePermissionsQuery.isLoading}
            >
              <option value="">Select a permission…</option>
              {availablePermissions.map((permission) => (
                <option key={permission.id} value={permission.id}>
                  {permission.name}
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
            disabled={!selectedPermissionId}
            loading={assignMutation.isPending}
            onClick={() => assignMutation.mutate(selectedPermissionId)}
          >
            Assign
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
