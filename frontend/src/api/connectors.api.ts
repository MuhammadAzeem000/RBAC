import { api } from '@/lib/api'
import type { Connector, TestConnectorResult } from '@/types/connector'

// integration-service, mounted behind the gateway at /api/connectors (not
// under /v1 — see backend/api-gateway/src/server.ts).
const base = '/connectors'

export const connectorsApi = {
  list: () => api.get<{ data: Connector[] }>(base).then((r) => r.data.data),
  setCredentials: (key: string, credential: Record<string, string | boolean>) =>
    api.put(`${base}/${key}/credentials`, { credential }).then((r) => r.data),
  test: (key: string) => api.post<TestConnectorResult>(`${base}/${key}/test`).then((r) => r.data),
}
