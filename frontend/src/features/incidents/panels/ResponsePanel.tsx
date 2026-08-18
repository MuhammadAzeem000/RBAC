import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { incidentsApi } from '@/api/incidents.api'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { PlaybookRunState } from '@/types/incident'

const STATE_TONE: Record<PlaybookRunState, 'slate' | 'green' | 'red' | 'amber' | 'blue'> = {
  pending_approval: 'amber',
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  cancelled: 'slate',
}
const STATE_LABEL: Record<PlaybookRunState, string> = {
  pending_approval: 'Awaiting approval',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

// No real SOAR automation engine exists in this codebase — starting a
// playbook here schedules a simulated completion a few seconds later (see
// backend/services/incident-service/src/services/playbookRun.service.ts).
export function ResponsePanel({ incidentId }: { incidentId: string }) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canRun = can('Incidents', 'Update')

  const catalogQuery = useQuery({ queryKey: ['incidents', 'playbook-catalog'], queryFn: () => incidentsApi.playbookCatalog() })
  const runsQuery = useQuery({
    queryKey: ['incidents', incidentId, 'playbook-runs'],
    queryFn: () => incidentsApi.listPlaybookRuns(incidentId),
    refetchInterval: 3000,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'playbook-runs'] })
    queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'timeline'] })
  }

  const startMutation = useMutation({
    mutationFn: (playbookKey: string) => incidentsApi.startPlaybookRun(incidentId, playbookKey),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const approveMutation = useMutation({
    mutationFn: (runId: string) => incidentsApi.approvePlaybookRun(incidentId, runId),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const runs = runsQuery.data ?? []
  const catalog = catalogQuery.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Eligible playbooks</p>
        {catalogQuery.isLoading ? (
          <Spinner />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {catalog.map((playbook) => (
              <li key={playbook.key} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2.5">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    {playbook.requiresApproval && <ShieldAlert className="size-3.5 text-amber-500" aria-hidden="true" />}
                    {playbook.name}
                  </p>
                  <p className="text-xs text-slate-400">{playbook.description}</p>
                </div>
                {canRun && (
                  <Button
                    variant="secondary"
                    disabled={startMutation.isPending}
                    onClick={() => startMutation.mutate(playbook.key)}
                  >
                    <Play className="size-3.5" aria-hidden="true" />
                    Run
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Run history</p>
        {runsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : runsQuery.isError ? (
          <ErrorState message={getErrorMessage(runsQuery.error)} onRetry={() => runsQuery.refetch()} />
        ) : runs.length === 0 ? (
          <EmptyState title="No playbook runs yet" description="Run an eligible playbook to see its status here." />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {runs.map((run) => (
              <li key={run.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{run.playbookKey}</p>
                  <p className="text-xs text-slate-400">
                    {run.outputsSummary ?? run.errorMessage ?? `Started ${new Date(run.createdAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATE_TONE[run.state]}>{STATE_LABEL[run.state]}</Badge>
                  {canRun && run.state === 'pending_approval' && (
                    <Button
                      variant="primary"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(run.id)}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
