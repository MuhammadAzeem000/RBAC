// The wire contract every publishing service's outbox worker serializes and
// publishes to the "audit.events" exchange, and this service's consumer
// deserializes. Kept in sync with each publisher's own local copy (e.g.
// backend/services/identity-service/src/interfaces/auditEvent.ts) —
// @responderx/shared exists now, but migrating this specific interface into
// it is optional and not done here, so this remains a by-hand convention,
// not enforced by types across the process boundary.
export interface AuditEventMessage {
  eventId: string;
  eventType: string;
  timestamp: string; // ISO-8601 — when the business transaction happened, not when this message is processed
  service: string;
  tenantId: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
}
