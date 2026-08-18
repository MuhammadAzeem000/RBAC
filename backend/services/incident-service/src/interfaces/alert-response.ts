export interface AlertResponse {
  id: bigint;
  incidentId: bigint;
  externalAlertId: string;
  source: string;
  summary: string;
  rawPayload: unknown;
  attachedBy: bigint;
  attachedAt: Date;
}
