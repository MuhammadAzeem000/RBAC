import { AxiosError } from 'axios'
import type { ApiErrorResponse } from '@/types/api'
import { isFieldErrors } from '@/types/api'

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined
    if (data?.error) {
      if (isFieldErrors(data.error)) {
        const firstField = Object.values(data.error.fieldErrors).flat().filter(Boolean)[0]
        return firstField ?? data.error.formErrors[0] ?? fallback
      }
      return data.error
    }
    if (error.message) return error.message
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined
    if (data?.error && isFieldErrors(data.error)) {
      const out: Record<string, string> = {}
      for (const [field, messages] of Object.entries(data.error.fieldErrors)) {
        if (messages?.[0]) out[field] = messages[0]
      }
      return out
    }
  }
  return {}
}
