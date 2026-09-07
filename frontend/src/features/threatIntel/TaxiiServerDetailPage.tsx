import { createColumnHelper } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { taxiiServersApi } from '@/api/taxiiServers.api'
import { taxiiCollectionsApi } from '@/api/taxiiCollections.api'
import { PollStatusBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { DescriptionList } from '@/components/ui/DescriptionList'
import { Drawer } from '@/components/ui/Drawer'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Spinner'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { TaxiiCollection } from '@/types/taxiiCollection'
import { DiscoverCollectionsDialog } from './DiscoverCollectionsDialog'
import { TaxiiCollectionForm, TaxiiCollectionFormFooter } from './TaxiiCollectionForm'
import type { TaxiiCollectionFormValues } from './TaxiiCollectionForm'
import { TaxiiServerForm, TaxiiServerFormFooter, toTaxiiServerInput } from './TaxiiServerForm'
import type { TaxiiServerFormValues } from './TaxiiServerForm'

const columnHelper = createColumnHelper<TaxiiCollection>()

export function TaxiiServerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()

  const [editingServer, setEditingServer] = useState(false)
  const [deletingServer, setDeletingServer] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [editingCollection, setEditingCollection] = useState<TaxiiCollection | null>(null)
  const [deletingCollection, setDeletingCollection] = useState<TaxiiCollection | null>(null)

  // No single-resource GET for a TAXII server — it's derived from the same
  // cached list query the servers list page uses.
  const serversQuery = useQuery({ queryKey: ['taxii-servers'], queryFn: () => taxiiServersApi.list() })
  const server = serversQuery.data?.find((s) => s.id === id)

  const collectionsQuery = useQuery({
    queryKey: ['taxii-servers', id, 'collections'],
    queryFn: () => taxiiCollectionsApi.list(id),
    enabled: Boolean(server),
  })

  const updateServerMutation = useMutation({
    mutationFn: (values: TaxiiServerFormValues) => taxiiServersApi.update(id, toTaxiiServerInput(values)),
    onSuccess: () => {
      toast.success('TAXII server updated')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers'] })
      setEditingServer(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteServerMutation = useMutation({
    mutationFn: () => taxiiServersApi.remove(id),
    onSuccess: () => {
      toast.success('TAXII server removed')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers'] })
      navigate('/threat-intel')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateCollectionMutation = useMutation({
    mutationFn: ({ collectionId, values }: { collectionId: string; values: TaxiiCollectionFormValues }) =>
      taxiiCollectionsApi.update(collectionId, values),
    onSuccess: () => {
      toast.success('Collection updated')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers', id, 'collections'] })
      setEditingCollection(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteCollectionMutation = useMutation({
    mutationFn: (collectionId: string) => taxiiCollectionsApi.remove(collectionId),
    onSuccess: () => {
      toast.success('Collection removed')
      queryClient.invalidateQueries({ queryKey: ['taxii-servers', id, 'collections'] })
      setDeletingCollection(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  // Synchronous on the backend — this mutation's response IS the poll
  // result, so writing it straight into the query cache reflects the new
  // status immediately, no follow-up refetch/interval needed.
  const pollNowMutation = useMutation({
    mutationFn: (collectionId: string) => taxiiCollectionsApi.pollNow(collectionId),
    onSuccess: (updated) => {
      queryClient.setQueryData<TaxiiCollection[]>(['taxii-servers', id, 'collections'], (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)),
      )
      if (updated.lastPollStatus === 'failed') {
        toast.error(updated.lastPollError ?? 'Poll failed')
      } else {
        toast.success('Poll completed')
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (serversQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (serversQuery.isError) {
    return <ErrorState message={getErrorMessage(serversQuery.error)} onRetry={() => serversQuery.refetch()} />
  }

  if (!server) {
    return <ErrorState message="TAXII server not found." />
  }

  const collections = collectionsQuery.data ?? []
  const collectionFormId = 'taxii-collection-form'

  const columns = [
    columnHelper.accessor('title', {
      header: 'Collection',
      cell: (info) => (
        <div>
          <p className="font-medium text-slate-900">{info.getValue() || info.row.original.collectionId}</p>
          <p className="font-mono text-xs text-slate-400">{info.row.original.collectionId}</p>
        </div>
      ),
    }),
    columnHelper.accessor('pollIntervalSeconds', {
      header: 'Poll interval',
      cell: (info) => `${info.getValue()}s`,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge isActive={info.getValue() === 'enabled'} />,
    }),
    columnHelper.accessor('lastPollStatus', {
      header: 'Last poll',
      cell: (info) => <PollStatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('lastPolledAt', {
      header: 'Last polled at',
      cell: (info) => (info.getValue() ? new Date(info.getValue() as string).toLocaleString() : '—'),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const collection = info.row.original
        return (
          <div className="flex justify-end gap-1">
            {can('Threat Intel', 'Update') && (
              <IconButton
                label="Poll now"
                disabled={pollNowMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  pollNowMutation.mutate(collection.id)
                }}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
            {can('Threat Intel', 'Update') && (
              <IconButton
                label="Edit collection"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingCollection(collection)
                }}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
            {can('Threat Intel', 'Delete') && (
              <IconButton
                label="Remove collection"
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeletingCollection(collection)
                }}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )
      },
    }),
  ]

  return (
    <div>
      <Link
        to="/threat-intel"
        className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to TAXII servers
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">{server.name}</h1>
          <StatusBadge isActive={server.status === 'enabled'} />
        </div>
        <div className="flex shrink-0 gap-2">
          {can('Threat Intel', 'Update') && (
            <Button variant="secondary" onClick={() => setEditingServer(true)}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          )}
          {can('Threat Intel', 'Delete') && (
            <Button variant="danger-ghost" onClick={() => setDeletingServer(true)}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody>
          <DescriptionList
            fields={[
              { label: 'Discovery URL', value: server.discoveryUrl },
              { label: 'API root', value: server.apiRoot ?? 'Not yet discovered' },
              { label: 'Authentication', value: <span className="capitalize">{server.authType}</span> },
              {
                label: 'Credentials',
                value: server.credentialConfigured ? 'Configured' : 'Not set',
              },
            ]}
          />
        </CardBody>
      </Card>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Polled collections</h2>
        {can('Threat Intel', 'Create') && (
          <Button variant="secondary" onClick={() => setDiscovering(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Discover collections
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={collections}
        pagination={{ page: 1, pageSize: Math.max(collections.length, 1), total: collections.length, totalPages: 1 }}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        search=""
        onSearchChange={() => {}}
        isLoading={collectionsQuery.isLoading}
        isError={collectionsQuery.isError}
        errorMessage={getErrorMessage(collectionsQuery.error)}
        onRetry={() => collectionsQuery.refetch()}
        emptyTitle="No collections configured"
        emptyDescription="Discover the server's collections and add one to start polling."
      />

      <Drawer
        open={editingServer}
        onClose={() => setEditingServer(false)}
        title="Edit TAXII server"
        footer={
          <TaxiiServerFormFooter
            formId="taxii-server-edit-form"
            saving={updateServerMutation.isPending}
            onCancel={() => setEditingServer(false)}
          />
        }
      >
        <TaxiiServerForm
          formId="taxii-server-edit-form"
          defaultValues={server}
          onSubmit={(values) => updateServerMutation.mutate(values)}
        />
      </Drawer>

      <ConfirmDialog
        open={deletingServer}
        title="Delete TAXII server"
        description={`Delete "${server.name}"? Its configured collections will stop being polled.`}
        confirmLabel="Delete"
        danger
        loading={deleteServerMutation.isPending}
        onConfirm={() => deleteServerMutation.mutate()}
        onCancel={() => setDeletingServer(false)}
      />

      <DiscoverCollectionsDialog
        open={discovering}
        onClose={() => setDiscovering(false)}
        serverId={id}
        existingCollections={collections}
      />

      <Drawer
        open={editingCollection !== null}
        onClose={() => setEditingCollection(null)}
        title="Edit collection"
        footer={
          <TaxiiCollectionFormFooter
            formId={collectionFormId}
            saving={updateCollectionMutation.isPending}
            onCancel={() => setEditingCollection(null)}
          />
        }
      >
        {editingCollection && (
          <TaxiiCollectionForm
            formId={collectionFormId}
            defaultValues={editingCollection}
            onSubmit={(values) =>
              updateCollectionMutation.mutate({ collectionId: editingCollection.id, values })
            }
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deletingCollection !== null}
        title="Remove collection"
        description={`Stop polling "${deletingCollection?.title ?? deletingCollection?.collectionId}"?`}
        confirmLabel="Remove"
        danger
        loading={deleteCollectionMutation.isPending}
        onConfirm={() => deletingCollection && deleteCollectionMutation.mutate(deletingCollection.id)}
        onCancel={() => setDeletingCollection(null)}
      />
    </div>
  )
}
