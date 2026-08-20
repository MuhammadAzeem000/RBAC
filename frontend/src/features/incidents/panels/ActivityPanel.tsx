import { useQuery } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents.api'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { getErrorMessage } from '@/lib/errors'

// Read-only by design — this is the incident's audit trail as well as its
// activity feed (append-only on the backend; no edit/delete route exists).
export function ActivityPanel({ incidentId }: { incidentId: string }) {
  const query = useQuery({
    queryKey: ['incidents', incidentId, 'timeline'],
    queryFn: () => incidentsApi.getTimeline(incidentId, { page: 1, pageSize: 100 }),
    refetchInterval: 5000,
  })

  const events = query.data?.data ?? []

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (query.isError) {
    return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
  }

  if (events.length === 0) {
    return <EmptyState title="No activity yet" description="Actions taken on this incident will appear here." />
  }

  return (
    <ol className="flex flex-col gap-0">
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < events.length - 1 && (
            <span className="absolute left-[5px] top-3 h-full w-px bg-slate-200" aria-hidden="true" />
          )}
          <span className="relative mt-1.5 size-2.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
          <div>
            <p className="text-sm text-slate-800">{event.summary}</p>
            <p className="text-xs text-slate-400">
              {new Date(event.createdAt).toLocaleString()}
              {event.actorUserId ? ` · User #${event.actorUserId}` : ' · System'}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
