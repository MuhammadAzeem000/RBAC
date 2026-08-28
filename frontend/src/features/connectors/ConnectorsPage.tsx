import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, KeyRound, XCircle } from 'lucide-react'
import { useState } from 'react'
import { connectorsApi } from '@/api/connectors.api'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useMyPermissions } from '@/hooks/useMyModules'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { Connector } from '@/types/connector'

interface CredentialFieldConfig {
  field: string
  label: string
  type: 'text' | 'password' | 'number' | 'checkbox'
  placeholder?: string
  hint?: string
  required?: boolean
}

// Each connector's credential shape is defined server-side (see
// backend/services/integration-service/src/connectors/*.connector.ts) —
// this just describes the fields each one needs, so the dialog knows what
// to render. Adding a connector means adding an entry here to match.
const CREDENTIAL_FIELDS: Record<string, CredentialFieldConfig[]> = {
  slack: [
    {
      field: 'botToken',
      label: 'Bot token',
      type: 'password',
      placeholder: 'xoxb-…',
      hint: 'A Slack bot token with the chat:write scope.',
      required: true,
    },
  ],
  virustotal: [
    {
      field: 'apiKey',
      label: 'API key',
      type: 'password',
      placeholder: '64-character API key',
      hint: 'Your VirusTotal account API key.',
      required: true,
    },
  ],
  smtp: [
    { field: 'host', label: 'SMTP host', type: 'text', placeholder: 'smtp.example.com', required: true },
    { field: 'port', label: 'Port', type: 'number', placeholder: '587', required: true },
    { field: 'secure', label: 'Use TLS (typically port 465)', type: 'checkbox' },
    { field: 'from', label: 'From address', type: 'text', placeholder: 'alerts@example.com', required: true },
    { field: 'user', label: 'Username', type: 'text', hint: 'Leave blank for an unauthenticated relay.' },
    { field: 'pass', label: 'Password', type: 'password' },
  ],
  qradar: [
    {
      field: 'host',
      label: 'Console URL',
      type: 'text',
      placeholder: 'https://qradar.example.com',
      hint: 'Your own QRadar console — every deployment is customer-hosted, no shared endpoint.',
      required: true,
    },
    { field: 'token', label: 'Authorized service token', type: 'password', required: true },
  ],
  fortigate: [
    {
      field: 'host',
      label: 'Appliance URL',
      type: 'text',
      placeholder: 'https://fortigate.example.com',
      hint: 'Your own FortiGate appliance — no shared endpoint.',
      required: true,
    },
    { field: 'apiToken', label: 'API token', type: 'password', required: true },
  ],
  crowdstrike: [
    { field: 'clientId', label: 'API client ID', type: 'text', required: true },
    { field: 'clientSecret', label: 'API client secret', type: 'password', required: true },
    {
      field: 'cloudUrl',
      label: 'Cloud URL',
      type: 'text',
      placeholder: 'https://api.crowdstrike.com',
      hint: 'Leave blank for the default us-1 cloud — set this for eu-1/us-2/us-gov-1.',
    },
  ],
  defender: [
    { field: 'tenantId', label: 'Azure AD tenant ID', type: 'text', required: true },
    { field: 'clientId', label: 'App registration client ID', type: 'text', required: true },
    { field: 'clientSecret', label: 'Client secret', type: 'password', required: true },
  ],
}

type CredentialFormValues = Record<string, string | boolean>

export function ConnectorsPage() {
  const queryClient = useQueryClient()
  const { can } = useMyPermissions()
  const canUpdate = can('Connectors', 'Update')

  const [credentialTarget, setCredentialTarget] = useState<Connector | null>(null)
  const [formValues, setFormValues] = useState<CredentialFormValues>({})

  const query = useQuery({ queryKey: ['connectors'], queryFn: () => connectorsApi.list() })

  const setCredentialsMutation = useMutation({
    mutationFn: ({ key, values }: { key: string; values: CredentialFormValues }) =>
      connectorsApi.setCredentials(key, values),
    onSuccess: () => {
      toast.success('Credentials saved')
      queryClient.invalidateQueries({ queryKey: ['connectors'] })
      setCredentialTarget(null)
      setFormValues({})
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const testMutation = useMutation({
    mutationFn: (key: string) => connectorsApi.test(key),
    onSuccess: (result, key) => {
      if (result.ok) toast.success(`${key}: connection test succeeded`)
      else toast.error(`${key}: ${result.error?.message ?? 'test failed'}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const connectors = query.data ?? []
  const fields = credentialTarget ? (CREDENTIAL_FIELDS[credentialTarget.key] ?? []) : []
  const missingRequired = fields.some((f) => f.required && !String(formValues[f.field] ?? '').trim())

  return (
    <div>
      <PageHeader
        title="Connectors"
        description="Outbound integrations playbook steps can call — Slack notifications, VirusTotal lookups, email, and more."
      />

      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : connectors.length === 0 ? (
        <EmptyState title="No connectors available" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {connectors.map((connector) => (
            <Card key={connector.key}>
              <CardHeader>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{connector.name}</p>
                  <Badge tone="slate" className="mt-1">
                    {connector.type}
                  </Badge>
                </div>
                <StatusBadge isActive={connector.status === 'enabled'} />
              </CardHeader>
              <CardBody>
                <div className="mb-3 flex items-center gap-1.5 text-xs">
                  {connector.credentialConfigured ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden="true" />
                      <span className="text-slate-600">Credentials configured</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3.5 text-slate-400" aria-hidden="true" />
                      <span className="text-slate-400">No credentials set</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {canUpdate && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCredentialTarget(connector)
                        setFormValues({})
                      }}
                    >
                      <KeyRound className="size-3.5" aria-hidden="true" />
                      {connector.credentialConfigured ? 'Update credentials' : 'Set credentials'}
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      variant="secondary"
                      disabled={!connector.credentialConfigured || testMutation.isPending}
                      onClick={() => testMutation.mutate(connector.key)}
                    >
                      Test
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={credentialTarget !== null}
        onClose={() => setCredentialTarget(null)}
        title={credentialTarget ? `${credentialTarget.name} credentials` : ''}
        size="sm"
      >
        {fields.length > 0 && (
          <div className="flex flex-col gap-3">
            {fields.map((f) =>
              f.type === 'checkbox' ? (
                <label key={f.field} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Checkbox
                    checked={Boolean(formValues[f.field])}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, [f.field]: e.target.checked }))}
                  />
                  {f.label}
                </label>
              ) : (
                <FormField key={f.field} label={f.label} required={f.required} hint={f.hint}>
                  {(id) => (
                    <Input
                      id={id}
                      type={f.type}
                      autoComplete="off"
                      value={String(formValues[f.field] ?? '')}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [f.field]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  )}
                </FormField>
              ),
            )}
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCredentialTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={missingRequired}
                loading={setCredentialsMutation.isPending}
                onClick={() => credentialTarget && setCredentialsMutation.mutate({ key: credentialTarget.key, values: formValues })}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
