import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { Role } from '@/types/role'

const roleFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  code: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().optional().or(z.literal('')),
  priority: z.coerce.number().int().min(0).max(1000),
  isDefault: z.boolean(),
})

export type RoleFormValues = z.infer<typeof roleFormSchema>

interface RoleFormProps {
  formId: string
  defaultValues?: Role
  onSubmit: (values: RoleFormValues) => void
}

export function RoleForm({ formId, defaultValues, onSubmit }: RoleFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      code: defaultValues?.code ?? '',
      description: defaultValues?.description ?? '',
      priority: defaultValues?.priority ?? 0,
      isDefault: defaultValues?.isDefault ?? false,
    },
  })

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        code: defaultValues.code ?? '',
        description: defaultValues.description ?? '',
        priority: defaultValues.priority,
        isDefault: defaultValues.isDefault,
      })
    }
  }, [defaultValues, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <FormField label="Name" required error={errors.name?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.name)} {...register('name')} />}
      </FormField>
      <FormField label="Code" error={errors.code?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.code)} {...register('code')} />}
      </FormField>
      <FormField label="Priority" hint="Higher values take precedence when merging permissions." error={errors.priority?.message}>
        {(id) => <Input id={id} type="number" invalid={Boolean(errors.priority)} {...register('priority')} />}
      </FormField>
      <FormField label="Description" error={errors.description?.message}>
        {(id) => <Textarea id={id} invalid={Boolean(errors.description)} {...register('description')} />}
      </FormField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox {...register('isDefault')} />
        Assign automatically to new users
      </label>
    </form>
  )
}

export function RoleFormFooter({
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
