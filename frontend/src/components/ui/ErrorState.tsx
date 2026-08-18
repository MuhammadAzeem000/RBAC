import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-700">Failed to load data</p>
      <p className="max-w-sm text-xs text-slate-400">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Retry
        </Button>
      )}
    </div>
  )
}
