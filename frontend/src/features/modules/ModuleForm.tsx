import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { AppModule } from '@/types/module'

const moduleFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  route: z.string().trim().max(255).optional().or(z.literal('')),
  icon: z.string().trim().max(100).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  description: z.string().trim().optional().or(z.literal('')),
})

export type ModuleFormValues = z.infer<typeof moduleFormSchema>

interface ModuleFormProps {
  formId: string
  defaultValues?: AppModule
  onSubmit: (values: ModuleFormValues) => void
}

export function ModuleForm({ formId, defaultValues, onSubmit }: ModuleFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      route: defaultValues?.route ?? '',
      icon: defaultValues?.icon ?? '',
      sortOrder: defaultValues?.sortOrder ?? 0,
      description: defaultValues?.description ?? '',
    },
  })

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        route: defaultValues.route ?? '',
        icon: defaultValues.icon ?? '',
        sortOrder: defaultValues.sortOrder,
        description: defaultValues.description ?? '',
      })
    }
  }, [defaultValues, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <FormField label="Name" required error={errors.name?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.name)} {...register('name')} />}
      </FormField>
      <FormField label="Route" error={errors.route?.message}>
        {(id) => <Input id={id} placeholder="/settings/users" invalid={Boolean(errors.route)} {...register('route')} />}
      </FormField>
      <FormField label="Icon" error={errors.icon?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.icon)} {...register('icon')} />}
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

export function ModuleFormFooter({
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
