import { useQuery } from '@tanstack/react-query'
import { Plus, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { playbooksApi } from '@/api/playbooks.api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'

export function PlaybooksListPage() {
  const navigate = useNavigate()
  const { can } = useMyPermissions()
  const canCreate = can('Playbooks', 'Create')

  const query = useQuery({ queryKey: ['playbooks'], queryFn: () => playbooksApi.listDetailed() })
  const playbooks = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Playbook Designer"
        description="Build and version your own playbooks — steps, connector actions, and approval gates."
        actions={
          canCreate && (
            <Button variant="primary" onClick={() => navigate('/playbooks/new')}>
              <Plus className="size-3.5" aria-hidden="true" />
              New playbook
            </Button>
          )
        }
      />

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : playbooks.length === 0 ? (
        <EmptyState title="No playbooks yet" description="Create one to start automating your response." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((playbook) => (
            <div
              key={playbook.key}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/playbooks/${playbook.key}/edit`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/playbooks/${playbook.key}/edit`)}
              className="cursor-pointer"
            >
              <Card className="hover:border-slate-300">
                <CardHeader>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      {playbook.requiresApproval && <ShieldAlert className="size-3.5 text-amber-500" aria-hidden="true" />}
                      {playbook.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{playbook.key}</p>
                  </div>
                  <Badge tone="slate">v{playbook.version}</Badge>
                </CardHeader>
                <CardBody>
                  {playbook.description && <p className="mb-2 text-xs text-slate-500">{playbook.description}</p>}
                  <p className="text-xs text-slate-400">
                    {playbook.stepCount} step{playbook.stepCount === 1 ? '' : 's'}
                  </p>
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
