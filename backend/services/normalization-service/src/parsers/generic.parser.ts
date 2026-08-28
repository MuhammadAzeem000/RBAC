import type { Entity, IngestAlertInput } from "@responderx/shared";
import { entityTypeSchema } from "@responderx/shared";
import { AlertParser, ParseError, optionalString, requireString } from "./types";

// For payloads already close to the canonical shape — manual testing, or a
// source not yet worth a dedicated parser. Deliberately lenient (case
// -insensitive severity, missing timestamp defaults to now) rather than a
// strict re-validation of the shared schema, since the point of this path
// is accepting "close enough" input, not enforcing the exact shape a real
// vendor parser guarantees.
interface GenericPayload {
  source?: unknown;
  externalId?: unknown;
  severity?: unknown;
  timestamp?: unknown;
  rawRef?: unknown;
  entities?: unknown;
}

const SEVERITIES: IngestAlertInput["severity"][] = ["low", "medium", "high", "critical"];

function mapSeverity(raw: unknown): IngestAlertInput["severity"] {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if ((SEVERITIES as string[]).includes(normalized)) {
      return normalized as IngestAlertInput["severity"];
    }
  }
  return "medium";
}

function extractEntities(raw: unknown): Entity[] {
  if (!Array.isArray(raw)) return [];
  const entities: Entity[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;
    const typeResult = entityTypeSchema.safeParse(candidate.type);
    if (typeResult.success && typeof candidate.value === "string" && candidate.value.trim().length > 0) {
      entities.push({ type: typeResult.data, value: candidate.value });
    }
  }
  return entities;
}

function parse(raw: unknown): IngestAlertInput {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("Generic payload must be a JSON object");
  }
  const payload = raw as GenericPayload;

  return {
    source: requireString(payload.source, "source"),
    externalId: requireString(payload.externalId, "externalId"),
    severity: mapSeverity(payload.severity),
    timestamp: optionalString(payload.timestamp) ?? new Date().toISOString(),
    entities: extractEntities(payload.entities),
    rawRef: optionalString(payload.rawRef) ?? null,
  };
}

export const genericParser: AlertParser = { vendor: "generic", parse };
