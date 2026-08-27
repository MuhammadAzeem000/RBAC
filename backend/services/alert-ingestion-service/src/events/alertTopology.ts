// The saga exchange between this service and incident-service (Phase 5.1's
// "Alert Ingestion Service" split). Deliberately separate from audit.events
// — this exchange carries the events the incident-creation saga actually
// depends on for correctness, not best-effort audit trail entries.
// Duplicated verbatim in incident-service's own copy of this file — same
// convention this codebase already uses for AUDIT_EXCHANGE (see
// auditTopology.ts), not centralized in @responderx/shared.
export const ALERT_EXCHANGE = "alert.events";

// Published by this service (outboxPublisher.service.ts's dual-publish),
// consumed by incident-service's alertConsumer.ts.
export const ALERT_INGESTED_ROUTING_KEY = "alert.ingested";

// Published by incident-service's outbox (its own dual-publish addition),
// consumed by this service's events/consumer.ts.
export const INCIDENT_CREATED_FOR_ALERT_ROUTING_KEY = "incident.created_for_alert";
export const INCIDENT_CREATE_FAILED_ROUTING_KEY = "incident.create_failed";

export const ALERT_INGESTION_REPLY_QUEUE = "alert-ingestion-service.incident-replies";
