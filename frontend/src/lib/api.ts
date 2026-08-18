import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import type { AuthTokens } from '@/types/auth'

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retried?: boolean
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState()
  if (!refreshToken) return null

  try {
    const response = await axios.post<AuthTokens>(
      `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
      { refreshToken },
    )
    useAuthStore.getState().setAccessToken(response.data.accessToken)
    return response.data.accessToken
  } catch {
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { config, response } = error
    const isAuthEndpoint =
      config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh')

    if (response?.status !== 401 || !config || config._retried || isAuthEndpoint) {
      throw error
    }

    config._retried = true
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })

    const newAccessToken = await refreshPromise
    if (!newAccessToken) {
      useAuthStore.getState().clearSession()
      throw error
    }

    config.headers.set('Authorization', `Bearer ${newAccessToken}`)
    return api.request(config as InternalAxiosRequestConfig)
  },
)
