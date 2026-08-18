export interface AuditLogEntry {
  id: string
  actorUserId: string
  action: string
  targetType: string
  targetId: string | null
  metadata: unknown
  createdAt: string
}
