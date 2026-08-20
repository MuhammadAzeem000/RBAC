// One shared exchange for audit events specifically, distinct from each
// service's own domain-event exchange (rbac.events, incident.events, ...) —
// audit is inherently cross-service/central, unlike a domain exchange that
// represents one service's own events for whichever consumers care about
// them. Every publishing service's outbox worker publishes here; this is
// the only consumer.
export const AUDIT_EXCHANGE = "audit.events";

// Dead-letter side: a message the consumer gives up on (repeated processing
// failures — a poison message, not a transient outage) is nacked without
// requeue, which RabbitMQ routes here instead of discarding it, so it's
// still inspectable/replayable rather than silently lost.
export const AUDIT_DLX = "audit.events.dlx";
export const AUDIT_QUEUE = "audit-service.events";
export const AUDIT_DLQ = "audit-service.events.dlq";
