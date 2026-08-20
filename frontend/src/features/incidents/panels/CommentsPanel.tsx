import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { incidentsApi } from '@/api/incidents.api'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'

export function CommentsPanel({ incidentId }: { incidentId: string }) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canComment = can('Incidents', 'Update')
  const [body, setBody] = useState('')

  const query = useQuery({
    queryKey: ['incidents', incidentId, 'comments'],
    queryFn: () => incidentsApi.listComments(incidentId),
  })

  const addMutation = useMutation({
    mutationFn: () => incidentsApi.addComment(incidentId, body),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'comments'] })
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'timeline'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const comments = query.data ?? []

  return (
    <div>
      {canComment && (
        <div className="mb-4 flex flex-col gap-2">
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add an analyst note…"
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={!body.trim()}
              loading={addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              Add comment
            </Button>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : comments.length === 0 ? (
        <EmptyState title="No comments yet" description="Analyst notes will appear here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md border border-slate-200 px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>User #{comment.authorUserId}</span>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
