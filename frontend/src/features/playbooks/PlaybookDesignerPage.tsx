import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { playbooksApi } from '@/api/playbooks.api'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import { PlaybookDesignerForm, toCreateInput, toSaveInput } from './PlaybookDesignerForm'
import type { PlaybookFormValues } from './PlaybookDesignerForm'

const FORM_ID = 'playbook-designer-form'

export function PlaybookDesignerPage() {
  const { key } = useParams<{ key: string }>()
  const isEditing = Boolean(key)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['playbooks', key],
    queryFn: () => playbooksApi.getDetail(key!),
    enabled: isEditing,
  })

  const createMutation = useMutation({
    mutationFn: (values: PlaybookFormValues) => playbooksApi.create(toCreateInput(values)),
    onSuccess: (playbook) => {
      toast.success('Playbook created')
      queryClient.invalidateQueries({ queryKey: ['playbooks'] })
      navigate(`/playbooks/${playbook.key}/edit`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const publishMutation = useMutation({
    mutationFn: (values: PlaybookFormValues) => playbooksApi.publishVersion(key!, toSaveInput(values)),
    onSuccess: (playbook) => {
      toast.success(`Published version ${playbook.version}`)
      queryClient.invalidateQueries({ queryKey: ['playbooks'] })
      queryClient.invalidateQueries({ queryKey: ['playbooks', key] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (isEditing && detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }
  if (isEditing && detailQuery.isError) {
    return <ErrorState message={getErrorMessage(detailQuery.error)} onRetry={() => detailQuery.refetch()} />
  }

  const saving = createMutation.isPending || publishMutation.isPending

  return (
    <div>
      <PageHeader
        title={isEditing ? `Edit "${detailQuery.data?.name}"` : 'New playbook'}
        description={
          isEditing
            ? `Saving publishes a new version — runs already in flight stay on v${detailQuery.data?.version}.`
            : 'Define the steps this playbook runs, in order.'
        }
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/playbooks')}>
              Back to list
            </Button>
            <Button type="submit" form={FORM_ID} variant="primary" loading={saving}>
              {isEditing ? 'Publish new version' : 'Create playbook'}
            </Button>
          </div>
        }
      />

      <PlaybookDesignerForm
        formId={FORM_ID}
        defaultValues={detailQuery.data}
        isEditing={isEditing}
        onSubmit={(values) => (isEditing ? publishMutation.mutate(values) : createMutation.mutate(values))}
      />
    </div>
  )
}
