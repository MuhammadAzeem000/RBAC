import type { Entity, IngestAlertInput } from "@responderx/shared";
import { AlertParser, ParseError, optionalString, requireString } from "./types";

// Splunk's "Webhook" alert action POSTs this shape (documented:
// https://docs.splunk.com/Documentation/Splunk/latest/Alert/WebhookAlertAction) —
// `sid` is the triggered search's own stable job id, `result` is the first
// matching event row (a flat object; field names are whatever the search's
// SPL produced, so this is inherently best-effort field-guessing, not a
// fixed schema). There's no single canonical severity field in Splunk
// itself — orgs commonly add one (e.g. via `eval severity=...`) for exactly
// this kind of integration, so several common spellings are accepted.
interface SplunkWebhookPayload {
  sid?: unknown;
  search_name?: unknown;
  results_link?: unknown;
  result?: Record<string, unknown>;
}

const SEVERITY_MAP: Record<string, IngestAlertInput["severity"]> = {
  critical: "critical",
  crit: "critical",
  high: "high",
  medium: "medium",
  med: "medium",
  low: "low",
  informational: "low",
  info: "low",
};

function mapSeverity(raw: unknown): IngestAlertInput["severity"] {
  if (typeof raw === "string") {
    const mapped = SEVERITY_MAP[raw.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  if (typeof raw === "number") {
    if (raw >= 8) return "critical";
    if (raw >= 6) return "high";
    if (raw >= 3) return "medium";
    if (raw >= 0) return "low";
  }
  // Splunk searches this integration wasn't specifically tuned for won't
  // carry a severity field at all — defaulting to "medium" (rather than
  // rejecting the payload) keeps the alert actionable instead of dropped.
  return "medium";
}

const IP_FIELDS = ["src_ip", "source_ip", "dest_ip", "destination_ip", "ip"];
const HOST_FIELDS = ["host", "hostname", "dest_host", "src_host"];
const USER_FIELDS = ["user", "username", "src_user"];
const HASH_FIELDS = ["file_hash", "md5", "sha1", "sha256", "hash"];

function extractEntities(result: Record<string, unknown>): Entity[] {
  const entities: Entity[] = [];
  const push = (type: Entity["type"], value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      entities.push({ type, value });
    }
  };
  for (const field of IP_FIELDS) push("ip", result[field]);
  for (const field of HOST_FIELDS) push("host", result[field]);
  for (const field of USER_FIELDS) push("user", result[field]);
  for (const field of HASH_FIELDS) push("file_hash", result[field]);
  return entities;
}

function parse(raw: unknown): IngestAlertInput {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("Splunk payload must be a JSON object");
  }
  const payload = raw as SplunkWebhookPayload;
  const sid = requireString(payload.sid, "sid");
  const result = payload.result && typeof payload.result === "object" ? payload.result : {};

  const timestamp = optionalString(result._time) ?? new Date().toISOString();
  const rawRef = optionalString(payload.results_link) ?? null;

  return {
    source: "splunk",
    externalId: sid,
    severity: mapSeverity(result.severity ?? result.urgency),
    timestamp,
    entities: extractEntities(result),
    rawRef,
  };
}

export const splunkParser: AlertParser = { vendor: "splunk", parse };
