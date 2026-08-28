import type { Entity, IngestAlertInput } from "@responderx/shared";
import { AlertParser, ParseError, optionalString, requireString } from "./types";

// Azure Monitor's "Common Alert Schema" — the payload shape delivered to a
// webhook action group, which Microsoft Sentinel analytics rules (and every
// other Azure Monitor alert source) fire through. Documented:
// https://learn.microsoft.com/azure/azure-monitor/alerts/alerts-common-schema
interface SentinelEssentials {
  severity?: unknown;
  firedDateTime?: unknown;
  originAlertId?: unknown;
  alertId?: unknown;
}
interface SentinelPayload {
  schemaId?: unknown;
  data?: {
    essentials?: SentinelEssentials;
    alertContext?: { properties?: Record<string, unknown> };
  };
}

// "SevN" severity levels are Azure Monitor's own fixed scale (0 = most
// severe). Documented alongside the common alert schema.
const SEVERITY_MAP: Record<string, IngestAlertInput["severity"]> = {
  sev0: "critical",
  sev1: "high",
  sev2: "medium",
  sev3: "low",
  sev4: "low",
};

function mapSeverity(raw: unknown): IngestAlertInput["severity"] {
  if (typeof raw === "string") {
    const mapped = SEVERITY_MAP[raw.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return "medium";
}

// alertContext.properties is provider-specific free-form key/value pairs —
// this maps the handful of key spellings Sentinel's own analytics rules
// commonly emit. Best-effort, not exhaustive (there's no fixed schema for
// this bag by design).
const ENTITY_KEY_MAP: Record<string, Entity["type"]> = {
  account: "user",
  username: "user",
  ipaddress: "ip",
  sourceip: "ip",
  host: "host",
  hostname: "host",
  domainname: "domain",
  url: "url",
  filehash: "file_hash",
};

function extractEntities(properties: Record<string, unknown> | undefined): Entity[] {
  if (!properties) return [];
  const entities: Entity[] = [];
  for (const [key, value] of Object.entries(properties)) {
    const type = ENTITY_KEY_MAP[key.trim().toLowerCase()];
    if (type && typeof value === "string" && value.trim().length > 0) {
      entities.push({ type, value });
    }
  }
  return entities;
}

function parse(raw: unknown): IngestAlertInput {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("Sentinel payload must be a JSON object");
  }
  const payload = raw as SentinelPayload;
  const essentials = payload.data?.essentials;
  if (!essentials) {
    throw new ParseError('Missing "data.essentials" in Sentinel common alert schema payload');
  }

  const originAlertId = requireString(essentials.originAlertId ?? essentials.alertId, "data.essentials.originAlertId");
  const timestamp = optionalString(essentials.firedDateTime) ?? new Date().toISOString();

  return {
    source: "sentinel",
    externalId: originAlertId,
    severity: mapSeverity(essentials.severity),
    timestamp,
    entities: extractEntities(payload.data?.alertContext?.properties),
    rawRef: null,
  };
}

export const sentinelParser: AlertParser = { vendor: "sentinel", parse };
