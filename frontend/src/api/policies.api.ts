import { api } from '@/lib/api'
import type { Policy } from '@/types/playbook'

// playbook-service, mounted behind the gateway at /api/v1/policies —
// read-only (see the Playbook Designer plan's decision 7), just enough to
// populate the designer's approval-gate picker with real Policy rows.
const base = '/v1/policies'

export const policiesApi = {
  list: () => api.get<{ data: Policy[] }>(base).then((r) => r.data.data),
}
