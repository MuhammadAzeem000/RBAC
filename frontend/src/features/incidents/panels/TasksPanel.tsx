import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { incidentsApi } from '@/api/incidents.api'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useMyPermissions } from '@/hooks/useMyModules'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'

export function TasksPanel({ incidentId }: { incidentId: string }) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canManage = can('Incidents', 'Update')
  const [title, setTitle] = useState('')

  const query = useQuery({
    queryKey: ['incidents', incidentId, 'tasks'],
    queryFn: () => incidentsApi.listTasks(incidentId),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'tasks'] })
    queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'timeline'] })
  }

  const createMutation = useMutation({
    mutationFn: () => incidentsApi.createTask(incidentId, { title }),
    onSuccess: () => {
      setTitle('')
      invalidate()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      incidentsApi.updateTask(incidentId, taskId, { status }),
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const tasks = query.data ?? []

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New task title…"
            className="flex-1"
          />
          <Button
            variant="primary"
            disabled={!title.trim()}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add task
          </Button>
        </div>
      )}

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet" description="Break the response down into trackable tasks." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {tasks.map((task) => {
            const completed = task.status === 'completed'
            return (
              <li key={task.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={completed}
                    disabled={!canManage || toggleMutation.isPending}
                    onChange={() =>
                      toggleMutation.mutate({ taskId: task.id, status: completed ? 'open' : 'completed' })
                    }
                  />
                  <span className={cn('text-sm text-slate-800', completed && 'text-slate-400 line-through')}>
                    {task.title}
                  </span>
                </label>
                {task.dueDate && (
                  <span className="whitespace-nowrap text-xs text-slate-400">
                    Due {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
