// Shared RabbitMQ topology. The backend publishes to this exchange without
// knowing who (if anyone) is listening — consumers (e.g. notification-service)
// own their own queues and bind to the routing keys they care about. Keep in
// sync with notification-service/src/rabbitmq/topology.ts.
export const EVENTS_EXCHANGE = "rbac.events";
export const USER_CREATED_ROUTING_KEY = "user.created";
// No consumer binds to this yet — published so a future service (e.g.
// notification-service provisioning a default channel, or incident-service
// warming a cache) can react without identity-service needing to know about
// it in advance.
export const TENANT_CREATED_ROUTING_KEY = "tenant.created";

// Separate exchange for the outbox publisher — audit events are a distinct
// concern from domain events above (audit MUST NOT be lost; rbac.events
// already tolerates loss, e.g. a dropped user.created if notification-service
// isn't bound yet). audit-service is the only consumer, bound with "#".
// Kept in sync with every other publisher's own copy and with
// backend/services/audit-service/src/events/topology.ts.
export const AUDIT_EXCHANGE = "audit.events";
