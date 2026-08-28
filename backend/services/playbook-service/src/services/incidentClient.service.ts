import { env } from "../config/env";

// The attach-path-style synchronous check: does this incidentId exist for
// the caller's tenant? Forwards the caller's own bearer token — no service
// token needed here, there IS a request context. Same pattern as
// alert-ingestion-service's ingestion.service.ts::verifyIncidentExists.
export async function verifyIncidentExists(token: string, incidentId: string): Promise<boolean> {
  const response = await fetch(`${env.INCIDENT_SERVICE_URL}/api/v1/incidents/${incidentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

export interface RecordIncidentTimelineEventInput {
  eventType: string;
  actorUserId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

// Called from inside Temporal Activities (temporal/activities.ts), which
// have no request context to forward a user JWT from — authenticated via a
// shared service token instead, the same M2M pattern this service's own
// callConnectorAction (temporal/activities.ts) already uses to reach
// integration-service. Throws (rather than swallowing) on failure so the
// enclosing Activity's own retry policy (see temporal/workflows.ts's
// proxyActivities config) handles it — this call is not best-effort, losing
// a timeline entry silently would leave a gap in the incident's audit trail.
export async function recordIncidentTimelineEvent(
  tenantId: string,
  incidentId: string,
  input: RecordIncidentTimelineEventInput,
): Promise<void> {
  const response = await fetch(`${env.INCIDENT_SERVICE_URL}/api/v1/incidents/${incidentId}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Token": env.INCIDENT_SERVICE_TOKEN },
    body: JSON.stringify({ tenantId, ...input }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to record incident timeline event (HTTP ${response.status}): ${body}`);
  }
}
