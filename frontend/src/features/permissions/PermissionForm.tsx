import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { actionsApi } from '@/api/actions.api'
import { modulesApi } from '@/api/modules.api'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import type { Permission } from '@/types/permission'

const createPermissionFormSchema = z.object({
  moduleId: z.string().trim().min(1, 'Module is required'),
  actionId: z.string().trim().min(1, 'Action is required'),
  name: z.string().trim().min(1, 'Name is required').max(150),
  code: z.string().trim().min(1, 'Code is required').max(150),
  description: z.string().trim().optional().or(z.literal('')),
})

export type PermissionFormValues = z.infer<typeof createPermissionFormSchema>

interface PermissionFormProps {
  formId: string
  mode: 'create' | 'edit'
  defaultValues?: Permission
  onSubmit: (values: PermissionFormValues) => void
}

export function PermissionForm({ formId, mode, defaultValues, onSubmit }: PermissionFormProps) {
  const modulesQuery = useQuery({
    queryKey: ['modules', 'all'],
    queryFn: () => modulesApi.list({ page: 1, pageSize: 100, isActive: true }),
    enabled: mode === 'create',
  })
  const actionsQuery = useQuery({
    queryKey: ['actions', 'all'],
    queryFn: () => actionsApi.list({ page: 1, pageSize: 100, isActive: true }),
    enabled: mode === 'create',
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PermissionFormValues>({
    resolver: zodResolver(createPermissionFormSchema),
    defaultValues: {
      moduleId: defaultValues?.moduleId ?? '',
      actionId: defaultValues?.actionId ?? '',
      name: defaultValues?.name ?? '',
      code: defaultValues?.code ?? '',
      description: defaultValues?.description ?? '',
    },
  })

  useEffect(() => {
    if (defaultValues) {
      reset({
        moduleId: defaultValues.moduleId,
        actionId: defaultValues.actionId,
        name: defaultValues.name,
        code: defaultValues.code,
        description: defaultValues.description ?? '',
      })
    }
  }, [defaultValues, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      {mode === 'create' && (
        <>
          <FormField label="Module" required error={errors.moduleId?.message}>
            {(id) => (
              <Select id={id} invalid={Boolean(errors.moduleId)} disabled={modulesQuery.isLoading} {...register('moduleId')}>
                <option value="">Select a module…</option>
                {modulesQuery.data?.data.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Action" required error={errors.actionId?.message}>
            {(id) => (
              <Select id={id} invalid={Boolean(errors.actionId)} disabled={actionsQuery.isLoading} {...register('actionId')}>
                <option value="">Select an action…</option>
                {actionsQuery.data?.data.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </>
      )}
      <FormField label="Name" required error={errors.name?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.name)} {...register('name')} />}
      </FormField>
      <FormField label="Code" required hint="e.g. users.view" error={errors.code?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.code)} {...register('code')} />}
      </FormField>
      <FormField label="Description" error={errors.description?.message}>
        {(id) => <Textarea id={id} invalid={Boolean(errors.description)} {...register('description')} />}
      </FormField>
    </form>
  )
}

export function PermissionFormFooter({
  formId,
  saving,
  onCancel,
}: {
  formId: string
  saving: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" form={formId} variant="primary" loading={saving}>
        Save
      </Button>
    </div>
  )
}
