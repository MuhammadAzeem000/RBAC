// audit-service is the sole consumer, bound with "#". Kept in sync with
// every other publisher's own copy and with
// backend/services/audit-service/src/events/topology.ts.
export const AUDIT_EXCHANGE = "audit.events";
