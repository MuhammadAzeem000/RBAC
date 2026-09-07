// The domain-events exchange for this service's own consumers (a future
// integration-service connector or normalization-service enrichment step),
// deliberately separate from audit.events — same reasoning as
// alert-ingestion-service's alertTopology.ts: this exchange is for events a
// future business consumer actually depends on, not the best-effort audit
// trail. No consumer exists yet in v1 — this is the seam for that future
// work, populated now so ingestion doesn't need to change later.
// Duplicated-by-convention (not centralized in @responderx/shared), same as
// every other service's own topology file.
export const THREAT_INTEL_EXCHANGE = "threat-intel.events";

// Published by this service (outboxPublisher.service.ts's dual-publish),
// once per newly-created-or-updated StixObject of type "indicator" — not
// for every STIX type, since malware/threat-actor/identity objects aren't
// IOCs and have no obvious v1 consumer.
export const THREAT_INTEL_IOC_INGESTED_ROUTING_KEY = "threat-intel.ioc.ingested";
