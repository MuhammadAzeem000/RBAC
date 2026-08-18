import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

const incidentFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  source: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(10_000).optional().or(z.literal('')),
})

export type IncidentFormValues = z.infer<typeof incidentFormSchema>

interface IncidentFormProps {
  formId: string
  onSubmit: (values: IncidentFormValues) => void
}

export function IncidentForm({ formId, onSubmit }: IncidentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: { title: '', severity: 'medium', category: '', source: '', description: '' },
  })

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <FormField label="Title" required error={errors.title?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.title)} {...register('title')} />}
      </FormField>
      <FormField label="Severity" required error={errors.severity?.message}>
        {(id) => (
          <Select id={id} invalid={Boolean(errors.severity)} {...register('severity')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        )}
      </FormField>
      <FormField label="Category" error={errors.category?.message}>
        {(id) => <Input id={id} placeholder="e.g. Phishing, Malware" {...register('category')} />}
      </FormField>
      <FormField label="Source" error={errors.source?.message}>
        {(id) => <Input id={id} placeholder="e.g. SIEM, EDR, manual report" {...register('source')} />}
      </FormField>
      <FormField label="Description" error={errors.description?.message}>
        {(id) => <Textarea id={id} rows={4} {...register('description')} />}
      </FormField>
    </form>
  )
}

export function IncidentFormFooter({
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
        Create incident
      </Button>
    </div>
  )
}
