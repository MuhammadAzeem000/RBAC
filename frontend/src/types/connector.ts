export type ConnectorStatus = 'enabled' | 'disabled'

export interface Connector {
  key: string
  name: string
  type: string
  status: ConnectorStatus
  credentialConfigured: boolean
  // The connector's playbook-callable actions ("test" excluded) — used by
  // the Playbook Designer's step editor to populate a dependent action
  // dropdown once a connector is chosen.
  actionKeys: string[]
}

export interface TestConnectorResult {
  ok: boolean
  result?: Record<string, unknown>
  error?: { message: string; retryable: boolean }
}
