import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { Action } from '@/types/action'

const actionFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  code: z.string().trim().min(1, 'Code is required').max(100),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
  description: z.string().trim().optional().or(z.literal('')),
})

export type ActionFormValues = z.infer<typeof actionFormSchema>

interface ActionFormProps {
  formId: string
  defaultValues?: Action
  onSubmit: (values: ActionFormValues) => void
}

export function ActionForm({ formId, defaultValues, onSubmit }: ActionFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      code: defaultValues?.code ?? '',
      sortOrder: defaultValues?.sortOrder ?? 0,
      description: defaultValues?.description ?? '',
    },
  })

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        code: defaultValues.code,
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
      <FormField label="Code" required hint="Unique machine-readable identifier." error={errors.code?.message}>
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

export function ActionFormFooter({
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
