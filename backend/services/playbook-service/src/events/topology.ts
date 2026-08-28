// The same "incident.events" domain-event exchange incident-service itself
// declares (backend/services/incident-service/src/events/topology.ts) — a
// plain RabbitMQ topic exchange, not owned exclusively by either service.
// PLAYBOOK_STARTED/PLAYBOOK_COMPLETED both move here from incident-service
// as part of Phase 5.2's split (their publishers — playbookRun.controller.ts
// and temporal/activities.ts respectively — both now live in this service).
export const INCIDENT_EVENTS_EXCHANGE = "incident.events";

export const ROUTING_KEYS = {
  PLAYBOOK_STARTED: "incident.playbook_started",
  PLAYBOOK_COMPLETED: "incident.playbook_completed",
} as const;
