export interface AuditLogEntry {
  id: string
  eventId: string
  eventType: string
  service: string
  actorId: string | null
  actorType: string
  action: string
  resourceType: string
  resourceId: string
  metadata: unknown
  payload: unknown
  occurredAt: string
  receivedAt: string
}
