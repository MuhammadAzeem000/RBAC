import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth.api'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import type { LoginRequest, RegisterRequest } from '@/types/auth'

export function useRegister() {
  const setSession = useAuthStore((state) => state.setSession)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: RegisterRequest) => authApi.register(payload),
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      })
      toast.success('Account created')
      navigate('/', { replace: true })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Could not create your account'))
    },
  })
}

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      })
      navigate('/', { replace: true })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Invalid credentials'))
    },
  })
}

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearSession()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}

export function useCurrentUser() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const setUser = useAuthStore((state) => state.setUser)

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await authApi.me()
      setUser(user)
      return user
    },
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  })
}
