import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { TaxiiCollection } from '@/types/taxiiCollection'

const taxiiCollectionFormSchema = z.object({
  title: z.string().trim().optional(),
  pollIntervalSeconds: z.coerce.number().int().min(60, 'Must be at least 60 seconds'),
  status: z.enum(['enabled', 'disabled']),
})

export type TaxiiCollectionFormValues = z.infer<typeof taxiiCollectionFormSchema>

interface TaxiiCollectionFormProps {
  formId: string
  defaultValues: TaxiiCollection
  onSubmit: (values: TaxiiCollectionFormValues) => void
}

export function TaxiiCollectionForm({ formId, defaultValues, onSubmit }: TaxiiCollectionFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaxiiCollectionFormValues>({
    resolver: zodResolver(taxiiCollectionFormSchema),
    defaultValues: {
      title: defaultValues.title ?? '',
      pollIntervalSeconds: defaultValues.pollIntervalSeconds,
      status: defaultValues.status,
    },
  })

  useEffect(() => {
    reset({
      title: defaultValues.title ?? '',
      pollIntervalSeconds: defaultValues.pollIntervalSeconds,
      status: defaultValues.status,
    })
  }, [defaultValues, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <FormField label="Title" error={errors.title?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.title)} {...register('title')} />}
      </FormField>
      <FormField
        label="Poll interval (seconds)"
        required
        hint="How often this collection is checked for new objects."
        error={errors.pollIntervalSeconds?.message}
      >
        {(id) => (
          <Input id={id} type="number" invalid={Boolean(errors.pollIntervalSeconds)} {...register('pollIntervalSeconds')} />
        )}
      </FormField>
      <FormField label="Status" error={errors.status?.message}>
        {(id) => (
          <Select id={id} invalid={Boolean(errors.status)} {...register('status')}>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </Select>
        )}
      </FormField>
    </form>
  )
}

export function TaxiiCollectionFormFooter({
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
