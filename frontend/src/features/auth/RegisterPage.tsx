import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldHalf } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useRegister } from '@/hooks/useAuth'

const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Your name is required').max(150),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
    password: z.string().min(8, 'At least 8 characters').max(255),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type RegisterFormValues = z.infer<typeof registerSchema>

export function RegisterPage() {
  const register = useRegister()
  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ShieldHalf className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-base font-semibold text-slate-900">Create the admin account</h1>
          <p className="text-xs text-slate-500">
            Only works once, to set up the very first administrator.
          </p>
        </div>

        <form
          onSubmit={handleSubmit((values) =>
            register.mutate({ name: values.name, email: values.email, password: values.password }),
          )}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          noValidate
        >
          <FormField label="Full name" required error={errors.name?.message}>
            {(id) => <Input id={id} invalid={Boolean(errors.name)} {...registerField('name')} />}
          </FormField>

          <FormField label="Email" required error={errors.email?.message}>
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                invalid={Boolean(errors.email)}
                {...registerField('email')}
              />
            )}
          </FormField>

          <FormField label="Password" required error={errors.password?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                invalid={Boolean(errors.password)}
                {...registerField('password')}
              />
            )}
          </FormField>

          <FormField label="Confirm password" required error={errors.confirmPassword?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                invalid={Boolean(errors.confirmPassword)}
                {...registerField('confirmPassword')}
              />
            )}
          </FormField>

          <Button type="submit" variant="primary" size="md" loading={register.isPending} className="mt-1 w-full">
            Create admin account
          </Button>

          <p className="text-center text-xs text-slate-500">
            Already set up?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
