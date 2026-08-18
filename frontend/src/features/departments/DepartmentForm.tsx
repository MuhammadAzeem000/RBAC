import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { Department } from '@/types/department'

const departmentFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  code: z.string().trim().max(50).optional().or(z.literal('')),
  description: z.string().trim().optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
})

export type DepartmentFormValues = z.infer<typeof departmentFormSchema>

interface DepartmentFormProps {
  formId: string
  defaultValues?: Department
  onSubmit: (values: DepartmentFormValues) => void
}

export function DepartmentForm({ formId, defaultValues, onSubmit }: DepartmentFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      code: defaultValues?.code ?? '',
      description: defaultValues?.description ?? '',
      sortOrder: defaultValues?.sortOrder ?? 0,
    },
  })

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        code: defaultValues.code ?? '',
        description: defaultValues.description ?? '',
        sortOrder: defaultValues.sortOrder,
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
      <FormField label="Sort order" error={errors.sortOrder?.message}>
        {(id) => <Input id={id} type="number" invalid={Boolean(errors.sortOrder)} {...register('sortOrder')} />}
      </FormField>
      <FormField label="Description" error={errors.description?.message}>
        {(id) => <Textarea id={id} invalid={Boolean(errors.description)} {...register('description')} />}
      </FormField>
    </form>
  )
}

export function DepartmentFormFooter({
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
