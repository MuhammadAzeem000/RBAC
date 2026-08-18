import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { departmentsApi } from '@/api/departments.api'
import { ActiveFilterSelect } from '@/components/ui/ActiveFilterSelect'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { useMyDepartmentIds } from '@/hooks/useCurrentUserAssignments'
import { useListState } from '@/hooks/useListState'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { Department } from '@/types/department'
import { DepartmentForm, DepartmentFormFooter } from './DepartmentForm'
import type { DepartmentFormValues } from './DepartmentForm'

const columnHelper = createColumnHelper<Department>()

export function DepartmentsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const myDepartmentIds = useMyDepartmentIds()
  const { can } = useMyPermissions()
  const { page, pageSize, search, isActive, setPage, setPageSize, setSearch, setIsActive } = useListState()

  const [drawerDepartment, setDrawerDepartment] = useState<Department | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Department | null>(null)

  const query = useQuery({
    queryKey: ['departments', { page, pageSize, search, isActive }],
    queryFn: () => departmentsApi.list({ page, pageSize, search, isActive }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: (values: DepartmentFormValues) => departmentsApi.create(values),
    onSuccess: () => {
      toast.success('Department created')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setDrawerDepartment(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: DepartmentFormValues }) =>
      departmentsApi.update(id, values),
    onSuccess: () => {
      toast.success('Department updated')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setDrawerDepartment(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => {
      toast.success('Department deleted')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setDeleteTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive: nextIsActive }: { id: string; isActive: boolean }) =>
      departmentsApi.update(id, { isActive: nextIsActive }),
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? 'Department activated' : 'Department deactivated')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setDeactivateTarget(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const columns = [
    columnHelper.accessor('name', {
      header: 'Department',
      cell: (info) => <div className="font-medium text-slate-900">{info.getValue()}</div>,
    }),
    columnHelper.accessor('sortOrder', { header: 'Sort order' }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => <StatusBadge isActive={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const department = info.row.original
        const isMine = myDepartmentIds.has(department.id)
        const canUpdate = can('Departments', 'Update')
        const canDelete = can('Departments', 'Delete')
        return (
          <div className="flex justify-end gap-1">
            {canUpdate &&
              (department.isActive ? (
                <IconButton
                  label={isMine ? "You can't change the active status of a department you belong to" : 'Deactivate department'}
                  variant="danger"
                  disabled={isMine}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeactivateTarget(department)
                  }}
                >
                  <PowerOff className="size-3.5" aria-hidden="true" />
                </IconButton>
              ) : (
                <IconButton
                  label={isMine ? "You can't change the active status of a department you belong to" : 'Activate department'}
                  disabled={isMine || setActiveMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMutation.mutate({ id: department.id, isActive: true })
                  }}
                >
                  <Power className="size-3.5" aria-hidden="true" />
                </IconButton>
              ))}
            {canUpdate && (
              <IconButton
                label="Edit department"
                onClick={(e) => {
                  e.stopPropagation()
                  setDrawerDepartment(department)
                }}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
            {canDelete && (
              <IconButton
                label={isMine ? "You can't delete a department you belong to" : 'Delete department'}
                variant="danger"
                disabled={isMine}
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(department)
                }}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )
      },
    }),
  ]

  const formId = 'department-form'
  const isEditing = drawerDepartment !== null && drawerDepartment !== 'new'

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Organizational units within your company."
        actions={
          can('Departments', 'Create') && (
            <Button variant="primary" onClick={() => setDrawerDepartment('new')}>
              <Plus className="size-3.5" aria-hidden="true" />
              New department
            </Button>
          )
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
        searchPlaceholder="Search by name…"
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={getErrorMessage(query.error)}
        onRetry={() => query.refetch()}
        onRowClick={(row) => navigate(`/departments/${row.id}`)}
        toolbarExtra={<ActiveFilterSelect value={isActive} onChange={setIsActive} />}
        emptyTitle="No departments found"
        emptyDescription="Create a department to organize your users."
      />

      <Drawer
        open={drawerDepartment !== null}
        onClose={() => setDrawerDepartment(null)}
        title={isEditing ? 'Edit department' : 'New department'}
        footer={
          <DepartmentFormFooter
            formId={formId}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDrawerDepartment(null)}
          />
        }
      >
        <DepartmentForm
          formId={formId}
          defaultValues={isEditing ? (drawerDepartment as Department) : undefined}
          onSubmit={(values) => {
            if (isEditing) updateMutation.mutate({ id: (drawerDepartment as Department).id, values })
            else createMutation.mutate(values)
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete department"
        description={`Delete "${deleteTarget?.name}"? Users assigned to it will be unassigned.`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate department"
        description={`Deactivate "${deactivateTarget?.name}"? It will no longer be usable until reactivated.`}
        confirmLabel="Deactivate"
        danger
        loading={setActiveMutation.isPending}
        onConfirm={() => deactivateTarget && setActiveMutation.mutate({ id: deactivateTarget.id, isActive: false })}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
