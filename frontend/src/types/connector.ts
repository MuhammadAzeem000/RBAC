export type ConnectorStatus = 'enabled' | 'disabled'

export interface Connector {
  key: string
  name: string
  type: string
  status: ConnectorStatus
  credentialConfigured: boolean
}

export interface TestConnectorResult {
  ok: boolean
  result?: Record<string, unknown>
  error?: { message: string; retryable: boolean }
}
