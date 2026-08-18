import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldHalf } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useLogin } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ShieldHalf className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-base font-semibold text-slate-900">RBAC Console</h1>
          <p className="text-xs text-slate-500">Sign in to manage access</p>
        </div>

        <form
          onSubmit={handleSubmit((values) => login.mutate(values))}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          noValidate
        >
          <FormField label="Email" required error={errors.email?.message}>
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                placeholder="jane.doe@example.com"
                invalid={Boolean(errors.email)}
                {...register('email')}
              />
            )}
          </FormField>

          <FormField label="Password" required error={errors.password?.message}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            )}
          </FormField>

          <Button type="submit" variant="primary" size="md" loading={login.isPending} className="mt-1 w-full">
            Sign in
          </Button>

          <p className="text-center text-xs text-slate-500">
            Setting up for the first time?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Create the admin account
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
