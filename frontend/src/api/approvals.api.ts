import { api } from '@/lib/api'
import type { ApprovalResponse } from '@/types/incident'

// playbook-service, mounted behind the gateway at /api/v1/approvals — same
// service as playbooks.api.ts, split into its own client since approvals
// are addressed by their own id, not an incident/run id.
const base = '/v1/approvals'

export const approvalsApi = {
  listPending: () =>
    api.get<{ data: ApprovalResponse[] }>(base, { params: { status: 'pending' } }).then((r) => r.data.data),
  decide: (approvalId: string, decision: 'approved' | 'rejected') =>
    api.post<ApprovalResponse>(`${base}/${approvalId}/decision`, { decision }).then((r) => r.data),
}
