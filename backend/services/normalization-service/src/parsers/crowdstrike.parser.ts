import type { Entity, IngestAlertInput } from "@responderx/shared";
import { AlertParser, ParseError, optionalString, requireString } from "./types";

// CrowdStrike Falcon's detection webhook/streaming-API event shape
// (documented: https://falcon.crowdstrike.com/documentation, "Detection
// Summary Event"). `behaviors` is an array — the highest-severity behavior
// drives entity extraction here since a single Alert/Entity set has to
// represent the whole detection, not one row per behavior.
interface CrowdStrikeBehavior {
  ioc_type?: unknown;
  ioc_value?: unknown;
  user_name?: unknown;
}
interface CrowdStrikeDevice {
  hostname?: unknown;
  local_ip?: unknown;
  external_ip?: unknown;
}
interface CrowdStrikePayload {
  detection_id?: unknown;
  created_timestamp?: unknown;
  max_severity?: unknown;
  max_severity_displayname?: unknown;
  device?: CrowdStrikeDevice;
  behaviors?: CrowdStrikeBehavior[];
}

// Falcon's own severity scale is 0-100 numeric; max_severity_displayname is
// the human label CrowdStrike itself renders for that number, preferred
// when present since it's authoritative rather than re-derived.
const DISPLAYNAME_MAP: Record<string, IngestAlertInput["severity"]> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "low",
};

function mapSeverity(displayName: unknown, numeric: unknown): IngestAlertInput["severity"] {
  if (typeof displayName === "string") {
    const mapped = DISPLAYNAME_MAP[displayName.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  if (typeof numeric === "number") {
    if (numeric >= 80) return "critical";
    if (numeric >= 60) return "high";
    if (numeric >= 30) return "medium";
    return "low";
  }
  return "medium";
}

// CrowdStrike's own IOC type vocabulary — mapped to this platform's
// canonical entity types (@responderx/shared's entityTypeSchema).
const IOC_TYPE_MAP: Record<string, Entity["type"]> = {
  hash_sha256: "file_hash",
  hash_sha1: "file_hash",
  hash_md5: "file_hash",
  domain: "domain",
  ip_address: "ip",
  url: "url",
};

function extractEntities(device: CrowdStrikeDevice | undefined, behaviors: CrowdStrikeBehavior[] | undefined): Entity[] {
  const entities: Entity[] = [];
  const push = (type: Entity["type"], value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      entities.push({ type, value });
    }
  };

  push("host", device?.hostname);
  push("ip", device?.local_ip);
  push("ip", device?.external_ip);

  for (const behavior of behaviors ?? []) {
    push("user", behavior.user_name);
    if (typeof behavior.ioc_type === "string") {
      const type = IOC_TYPE_MAP[behavior.ioc_type.trim().toLowerCase()];
      if (type) push(type, behavior.ioc_value);
    }
  }

  return entities;
}

function parse(raw: unknown): IngestAlertInput {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("CrowdStrike payload must be a JSON object");
  }
  const payload = raw as CrowdStrikePayload;
  const detectionId = requireString(payload.detection_id, "detection_id");
  const timestamp = optionalString(payload.created_timestamp) ?? new Date().toISOString();

  return {
    source: "crowdstrike",
    externalId: detectionId,
    severity: mapSeverity(payload.max_severity_displayname, payload.max_severity),
    timestamp,
    entities: extractEntities(payload.device, payload.behaviors),
    rawRef: null,
  };
}

export const crowdstrikeParser: AlertParser = { vendor: "crowdstrike", parse };
