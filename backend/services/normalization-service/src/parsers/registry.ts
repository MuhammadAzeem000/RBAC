import { AlertParser } from "./types";
import { splunkParser } from "./splunk.parser";
import { sentinelParser } from "./sentinel.parser";
import { crowdstrikeParser } from "./crowdstrike.parser";
import { genericParser } from "./generic.parser";

// Mirrors integration-service's connectors/registry.ts pattern — one place
// mapping a vendor key to its handler, extended by adding a new parser file
// and one line here, not a design change.
export const PARSER_REGISTRY: Record<string, AlertParser> = {
  splunk: splunkParser,
  sentinel: sentinelParser,
  crowdstrike: crowdstrikeParser,
  generic: genericParser,
};

export function getParser(vendor: string): AlertParser | null {
  return PARSER_REGISTRY[vendor] ?? null;
}
