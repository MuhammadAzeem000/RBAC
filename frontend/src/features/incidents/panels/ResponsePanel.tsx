import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { playbooksApi } from '@/api/playbooks.api'
import { approvalsApi } from '@/api/approvals.api'
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

// Real orchestration (Temporal, playbook-service) — starting a playbook here
// starts a durable Workflow Execution, running each step through
// integration-service's connector runtime where a step is bound to one.
export function ResponsePanel({ incidentId }: { incidentId: string }) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canRun = can('Incidents', 'Update')

  const catalogQuery = useQuery({ queryKey: ['playbook-catalog'], queryFn: () => playbooksApi.catalog() })
  const runsQuery = useQuery({
    queryKey: ['incidents', incidentId, 'playbook-runs'],
    queryFn: () => playbooksApi.listForIncident(incidentId),
    refetchInterval: 3000,
  })
  // Tenant-wide pending approvals — cheap at this scale, and the only way
  // to resolve "which Approval row gates this run" without a dedicated
  // per-run lookup endpoint (an Approval is addressed by its own id, not
  // the playbook run's — see approvals.api.ts).
  const pendingApprovalsQuery = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => approvalsApi.listPending(),
    refetchInterval: 3000,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'playbook-runs'] })
    queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
    queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'timeline'] })
  }

  const startMutation = useMutation({
    mutationFn: (playbookKey: string) => playbooksApi.start({ incidentId, playbookKey }),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const approveMutation = useMutation({
    mutationFn: (approvalId: string) => approvalsApi.decide(approvalId, 'approved'),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const runs = runsQuery.data ?? []
  const catalog = catalogQuery.data ?? []
  const pendingApprovals = pendingApprovalsQuery.data ?? []

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
            {runs.map((run) => {
              const pendingApproval = pendingApprovals.find((approval) => approval.playbookRunId === run.id)
              return (
                <li key={run.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{run.playbookKey}</p>
                    <p className="text-xs text-slate-400">
                      {run.outputsSummary ?? run.errorMessage ?? `Started ${new Date(run.createdAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATE_TONE[run.state]}>{STATE_LABEL[run.state]}</Badge>
                    {canRun && run.state === 'pending_approval' && pendingApproval && (
                      <Button
                        variant="primary"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(pendingApproval.id)}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
