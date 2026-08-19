// The outbox publisher's target exchange — audit-service is the sole
// consumer, bound with "#". Distinct from ./the rbac.events exchange this
// service already consumes domain events from. Kept in sync with every
// other publisher's own copy and with
// backend/services/audit-service/src/events/topology.ts.
export const AUDIT_EXCHANGE = "audit.events";
