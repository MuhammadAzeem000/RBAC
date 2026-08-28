import type { IngestAlertInput } from "@responderx/shared";
import { env } from "../config/env";

// Hands a parsed, canonical alert off to alert-ingestion-service — the
// system of record for Alert/Entity, owning dedup, the outbox, and the
// incident-creation saga. This service's job ends at "produce a validated
// payload"; it never writes Alert rows itself. Machine-to-machine (a
// vendor webhook has no ResponderX JWT to forward) via the new
// POST /api/v1/alerts/system route, same requireServiceToken pattern as
// incident-service's .../timeline and playbook-service's
// .../playbook-runs/system routes.
export async function ingestNormalizedAlert(tenantId: string, input: IngestAlertInput): Promise<void> {
  const response = await fetch(`${env.ALERT_INGESTION_SERVICE_URL}/api/v1/alerts/system`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Token": env.ALERT_INGESTION_SERVICE_TOKEN },
    body: JSON.stringify({ tenantId, ...input }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`alert-ingestion-service returned HTTP ${response.status}: ${body}`);
  }
}
