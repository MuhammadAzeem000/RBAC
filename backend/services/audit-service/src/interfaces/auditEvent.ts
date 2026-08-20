// The wire contract every publishing service's outbox worker serializes and
// publishes to the "audit.events" exchange, and this service's consumer
// deserializes. Kept in sync with each publisher's own local copy (e.g.
// backend/services/identity-service/src/interfaces/auditEvent.ts) — there is
// no shared package (see shared/README.md's now-deleted reasoning from the
// auth-service episode; the same tradeoff applies here), so this is a
// by-hand convention, not enforced by types across the process boundary.
export interface AuditEventMessage {
  eventId: string;
  eventType: string;
  timestamp: string; // ISO-8601 — when the business transaction happened, not when this message is processed
  service: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
}
