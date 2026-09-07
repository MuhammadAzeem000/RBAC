import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { taxiiCollectionsApi } from '@/api/taxiiCollections.api'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { TaxiiCollection } from '@/types/taxiiCollection'

interface DiscoverCollectionsDialogProps {
  open: boolean
  onClose: () => void
  serverId: string
  existingCollections: TaxiiCollection[]
}

export function DiscoverCollectionsDialog({
  open,
  onClose,
  serverId,
  existingCollections,
}: DiscoverCollectionsDialogProps) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['taxii-servers', serverId, 'discover'],
    queryFn: () => taxiiCollectionsApi.discover(serverId),
    enabled: open,
  })

  const addMutation = useMutation({
    mutationFn: (collectionId: string) =>
      taxiiCollectionsApi.create(serverId, { collectionId, pollIntervalSeconds: 900 }),
    onSuccess: () => {
      toast.success('Collection added')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers', serverId, 'collections'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const existingIds = new Set(existingCollections.map((c) => c.collectionId))
  const discovered = query.data ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Discover collections"
      description="Collections this TAXII server advertises — add one to start polling it."
      size="lg"
    >
      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : discovered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">This server advertises no collections.</p>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100">
          {discovered.map((collection) => {
            const alreadyAdded = existingIds.has(collection.id)
            return (
              <div key={collection.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{collection.title}</p>
                  {collection.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{collection.description}</p>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{collection.id}</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={alreadyAdded || addMutation.isPending}
                  onClick={() => addMutation.mutate(collection.id)}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  {alreadyAdded ? 'Added' : 'Add'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Dialog>
  )
}
