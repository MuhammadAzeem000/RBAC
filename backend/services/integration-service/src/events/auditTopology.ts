// The outbox publisher's target exchange — audit-service is the sole
// consumer, bound with "#". Kept in sync with every other publisher's own
// copy (incident-service, identity-service, notification-service) and with
// backend/services/audit-service/src/events/topology.ts.
export const AUDIT_EXCHANGE = "audit.events";
