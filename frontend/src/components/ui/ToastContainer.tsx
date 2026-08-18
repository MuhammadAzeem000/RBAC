import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'
import type { ToastVariant } from '@/stores/toastStore'
import { cn } from '@/lib/cn'

const variantConfig: Record<ToastVariant, { icon: typeof CheckCircle2; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  error: { icon: XCircle, classes: 'border-red-200 bg-red-50 text-red-800' },
  info: { icon: Info, classes: 'border-slate-200 bg-white text-slate-800' },
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const config = variantConfig[t.variant]
        const Icon = config.icon
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm shadow-md',
              config.classes,
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-current opacity-60 hover:opacity-100"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
