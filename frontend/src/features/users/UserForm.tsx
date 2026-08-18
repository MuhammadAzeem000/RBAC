import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import type { User } from '@/types/user'

const baseFields = {
  name: z.string().trim().min(1, 'Name is required').max(150),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
}

const createUserFormSchema = z.object({
  ...baseFields,
  password: z.string().min(8, 'At least 8 characters').max(255),
})

const editUserFormSchema = z.object({
  ...baseFields,
  password: z
    .string()
    .max(255)
    .refine((value) => value === '' || value.length >= 8, { message: 'At least 8 characters' }),
})

export type UserFormValues = z.infer<typeof createUserFormSchema>

interface UserFormProps {
  formId: string
  mode: 'create' | 'edit'
  defaultValues?: User
  onSubmit: (values: UserFormValues) => void
}

export function UserForm({ formId, mode, defaultValues, onSubmit }: UserFormProps) {
  const schema = mode === 'create' ? createUserFormSchema : editUserFormSchema
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      email: defaultValues?.email ?? '',
      password: '',
    },
  })

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        email: defaultValues.email,
        password: '',
      })
    }
  }, [defaultValues, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <FormField label="Full name" required error={errors.name?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.name)} {...register('name')} />}
      </FormField>
      <FormField label="Email" required error={errors.email?.message}>
        {(id) => <Input id={id} type="email" invalid={Boolean(errors.email)} {...register('email')} />}
      </FormField>
      <FormField
        label={mode === 'create' ? 'Password' : 'New password'}
        required={mode === 'create'}
        hint={mode === 'edit' ? 'Leave blank to keep the current password.' : undefined}
        error={errors.password?.message}
      >
        {(id) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        )}
      </FormField>
    </form>
  )
}

export function UserFormFooter({
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
