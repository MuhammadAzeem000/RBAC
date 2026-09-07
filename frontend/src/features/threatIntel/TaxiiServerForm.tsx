import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { CreateTaxiiServerInput, TaxiiServer } from '@/types/taxiiServer'

const taxiiServerFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  discoveryUrl: z.string().trim().url('Must be a valid URL, e.g. https://taxii.example.com/taxii2/'),
  authType: z.enum(['none', 'basic', 'bearer']),
  // Credential fields are always optional here, even when authType isn't
  // "none" — the backend's credential is write-only, so leaving these blank
  // on an edit keeps whatever is already stored rather than clearing it.
  username: z.string().trim().optional(),
  password: z.string().trim().optional(),
  token: z.string().trim().optional(),
})

export type TaxiiServerFormValues = z.infer<typeof taxiiServerFormSchema>

// Only includes `credential` in the payload when the user actually typed
// something — otherwise an edit would silently wipe a previously-stored
// credential just because the (never-prefilled) fields were empty.
// Returned as the (structurally compatible) Create shape — every field it
// sets is optional on UpdateTaxiiServerInput too, so this satisfies both
// `taxiiServersApi.create` and `.update` call sites without a union return
// type (which TS won't narrow automatically at each call site).
export function toTaxiiServerInput(values: TaxiiServerFormValues): CreateTaxiiServerInput {
  const credential =
    values.authType === 'basic' && (values.username || values.password)
      ? { username: values.username || undefined, password: values.password || undefined }
      : values.authType === 'bearer' && values.token
        ? { token: values.token }
        : undefined

  return {
    name: values.name,
    discoveryUrl: values.discoveryUrl,
    authType: values.authType,
    ...(credential ? { credential } : {}),
  }
}

interface TaxiiServerFormProps {
  formId: string
  defaultValues?: TaxiiServer
  onSubmit: (values: TaxiiServerFormValues) => void
}

export function TaxiiServerForm({ formId, defaultValues, onSubmit }: TaxiiServerFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TaxiiServerFormValues>({
    resolver: zodResolver(taxiiServerFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      discoveryUrl: defaultValues?.discoveryUrl ?? '',
      authType: defaultValues?.authType ?? 'none',
      username: '',
      password: '',
      token: '',
    },
  })

  useEffect(() => {
    if (defaultValues) {
      reset({
        name: defaultValues.name,
        discoveryUrl: defaultValues.discoveryUrl,
        authType: defaultValues.authType,
        username: '',
        password: '',
        token: '',
      })
    }
  }, [defaultValues, reset])

  const authType = watch('authType')

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <FormField label="Name" required error={errors.name?.message}>
        {(id) => <Input id={id} invalid={Boolean(errors.name)} {...register('name')} />}
      </FormField>
      <FormField
        label="Discovery URL"
        required
        hint="The server's own /taxii2/ discovery endpoint."
        error={errors.discoveryUrl?.message}
      >
        {(id) => (
          <Input
            id={id}
            placeholder="https://taxii.example.com/taxii2/"
            invalid={Boolean(errors.discoveryUrl)}
            {...register('discoveryUrl')}
          />
        )}
      </FormField>
      <FormField label="Authentication" error={errors.authType?.message}>
        {(id) => (
          <Select id={id} invalid={Boolean(errors.authType)} {...register('authType')}>
            <option value="none">None</option>
            <option value="basic">Basic (username/password)</option>
            <option value="bearer">Bearer token</option>
          </Select>
        )}
      </FormField>

      {authType === 'basic' && (
        <>
          <FormField
            label="Username"
            hint={defaultValues ? 'Leave blank to keep the current username/password.' : undefined}
          >
            {(id) => <Input id={id} autoComplete="off" {...register('username')} />}
          </FormField>
          <FormField label="Password">
            {(id) => <Input id={id} type="password" autoComplete="off" {...register('password')} />}
          </FormField>
        </>
      )}

      {authType === 'bearer' && (
        <FormField
          label="Bearer token"
          hint={defaultValues ? 'Leave blank to keep the current token.' : undefined}
        >
          {(id) => <Input id={id} type="password" autoComplete="off" {...register('token')} />}
        </FormField>
      )}
    </form>
  )
}

export function TaxiiServerFormFooter({
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
