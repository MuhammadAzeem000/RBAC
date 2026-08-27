// The saga exchange between alert-ingestion-service and this service
// (Phase 5.1's "Alert Ingestion Service" split). Deliberately separate from
// audit.events — this exchange carries the events the incident-creation
// saga actually depends on for correctness, not best-effort audit trail
// entries. Duplicated verbatim from alert-ingestion-service's own copy of
// this file — same convention this codebase already uses for AUDIT_EXCHANGE
// (see auditTopology.ts), not centralized in @responderx/shared.
export const ALERT_EXCHANGE = "alert.events";

// Published by alert-ingestion-service's outbox (its dual-publish),
// consumed here by events/alertConsumer.ts.
export const ALERT_INGESTED_ROUTING_KEY = "alert.ingested";

// Published by this service's own outbox (its dual-publish addition),
// consumed by alert-ingestion-service's events/consumer.ts.
export const INCIDENT_CREATED_FOR_ALERT_ROUTING_KEY = "incident.created_for_alert";
export const INCIDENT_CREATE_FAILED_ROUTING_KEY = "incident.create_failed";

export const ALERT_INGESTION_REPLY_QUEUE = "alert-ingestion-service.incident-replies";

// This service's own reply-consumer queue name (mirrors the reply queue
// naming convention above, one level down the saga).
export const INCIDENT_SERVICE_ALERT_QUEUE = "incident-service.alert-events";
