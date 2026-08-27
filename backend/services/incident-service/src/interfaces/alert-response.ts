export interface EntityResponse {
  id: bigint;
  type: string;
  value: string;
  confidence: number | null;
  attributes: unknown;
}

export interface AlertResponse {
  id: bigint;
  incidentId: bigint;
  externalAlertId: string;
  source: string;
  summary: string | null;
  rawPayload: unknown;
  severity: string | null;
  occurredAt: Date | null;
  rawRef: string | null;
  attachedBy: bigint;
  attachedAt: Date;
  entities: EntityResponse[];
}
