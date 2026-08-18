import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { incidentsApi } from '@/api/incidents.api'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'

export function AlertsPanel({ incidentId }: { incidentId: string }) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canManage = can('Incidents', 'Update')
  const [open, setOpen] = useState(false)
  const [externalAlertId, setExternalAlertId] = useState('')
  const [source, setSource] = useState('')
  const [summary, setSummary] = useState('')

  const query = useQuery({
    queryKey: ['incidents', incidentId, 'alerts'],
    queryFn: () => incidentsApi.listAlerts(incidentId),
  })

  const attachMutation = useMutation({
    mutationFn: () => incidentsApi.attachAlert(incidentId, { externalAlertId, source, summary }),
    onSuccess: () => {
      setExternalAlertId('')
      setSource('')
      setSummary('')
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'alerts'] })
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'timeline'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const alerts = query.data ?? []

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">Alerts attached to this incident — immutable source context.</p>
        {canManage && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Attach alert
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : alerts.length === 0 ? (
        <EmptyState title="No alerts attached" description="Attach normalized alerts related to this incident." />
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-md border border-slate-200 px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">{alert.externalAlertId}</p>
                <span className="text-xs text-slate-400">{alert.source}</span>
              </div>
              <p className="text-sm text-slate-600">{alert.summary}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Attach alert" size="sm">
        <div className="flex flex-col gap-3">
          <FormField label="External alert ID" required>
            {(id) => <Input id={id} value={externalAlertId} onChange={(e) => setExternalAlertId(e.target.value)} />}
          </FormField>
          <FormField label="Source" required>
            {(id) => <Input id={id} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. SIEM" />}
          </FormField>
          <FormField label="Summary" required>
            {(id) => <Textarea id={id} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />}
          </FormField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!externalAlertId.trim() || !source.trim() || !summary.trim()}
            loading={attachMutation.isPending}
            onClick={() => attachMutation.mutate()}
          >
            Attach
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
