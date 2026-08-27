// A separate exchange from identity-service's "rbac.events" — incident
// events are a genuinely different domain, not RBAC/identity activity. Any
// future consumer (e.g. notification-service, if it grows incident-aware
// notifications) binds its own queue to the routing keys it cares about,
// same pattern as rbac.events.
export const INCIDENT_EVENTS_EXCHANGE = "incident.events";

export const ROUTING_KEYS = {
  CREATED: "incident.created",
  UPDATED: "incident.updated",
  ASSIGNED: "incident.assigned",
  STATUS_CHANGED: "incident.status_changed",
  SEVERITY_CHANGED: "incident.severity_changed",
  TASK_CREATED: "incident.task_created",
  TASK_COMPLETED: "incident.task_completed",
  EVIDENCE_ADDED: "incident.evidence_added",
  PLAYBOOK_STARTED: "incident.playbook_started",
  PLAYBOOK_COMPLETED: "incident.playbook_completed",
  RESOLVED: "incident.resolved",
  CLOSED: "incident.closed",
} as const;
