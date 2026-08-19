// Separate from ./topology.ts's INCIDENT_EVENTS_EXCHANGE (that one is this
// service's own domain events — timeline-driven, best-effort, already
// documented as tolerating loss). This exchange is the outbox publisher's
// target: audit-service is the sole consumer, bound with "#". Kept in sync
// with every other publisher's own copy and with
// backend/services/audit-service/src/events/topology.ts.
export const AUDIT_EXCHANGE = "audit.events";
