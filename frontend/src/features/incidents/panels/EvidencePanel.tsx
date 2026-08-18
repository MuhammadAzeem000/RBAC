import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { incidentsApi } from '@/api/incidents.api'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'

// No binary file storage in this MVP (spec: "do not place large binaries in
// the incident relational record") — evidence is a reference to wherever the
// file actually lives, e.g. a link into an existing document/case system.
export function EvidencePanel({ incidentId }: { incidentId: string }) {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canManage = can('Incidents', 'Update')
  const [filename, setFilename] = useState('')
  const [storageRef, setStorageRef] = useState('')

  const query = useQuery({
    queryKey: ['incidents', incidentId, 'evidence'],
    queryFn: () => incidentsApi.listEvidence(incidentId),
  })

  const addMutation = useMutation({
    mutationFn: () => incidentsApi.addEvidence(incidentId, { filename, storageRef }),
    onSuccess: () => {
      setFilename('')
      setStorageRef('')
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'evidence'] })
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId, 'timeline'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const evidence = query.data ?? []

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="Filename" className="flex-1" />
          <Input
            value={storageRef}
            onChange={(e) => setStorageRef(e.target.value)}
            placeholder="Storage reference (URL or path)"
            className="flex-1"
          />
          <Button
            variant="primary"
            disabled={!filename.trim() || !storageRef.trim()}
            loading={addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add evidence
          </Button>
        </div>
      )}

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : evidence.length === 0 ? (
        <EmptyState title="No evidence yet" description="Reference files or artifacts relevant to this incident." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {evidence.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.filename}</p>
                <p className="text-xs text-slate-400">{item.storageRef}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-slate-400">
                {new Date(item.uploadedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
