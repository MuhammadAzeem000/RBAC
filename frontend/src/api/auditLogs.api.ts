import { api } from '@/lib/api'
import { buildParams } from '@/lib/queryParams'
import type { PaginatedResult } from '@/types/pagination'
import type { AuditLogEntry } from '@/types/auditLog'

export interface AuditLogListQuery {
  page?: number
  pageSize?: number
}

export const auditLogsApi = {
  list: (query: AuditLogListQuery) =>
    api.get<PaginatedResult<AuditLogEntry>>('/audit-logs', { params: buildParams(query) }).then((r) => r.data),
}
