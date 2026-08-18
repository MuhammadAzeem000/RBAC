export interface ApiFieldErrors {
  formErrors: string[]
  fieldErrors: Record<string, string[] | undefined>
}

export interface ApiErrorResponse {
  error: string | ApiFieldErrors
}

export function isFieldErrors(error: string | ApiFieldErrors): error is ApiFieldErrors {
  return typeof error === 'object' && error !== null
}
