import type { IngestAlertInput } from "@responderx/shared";

export interface AlertParser {
  vendor: string;
  parse(raw: unknown): IngestAlertInput;
}

// Thrown by a parser on an unrecognized/malformed payload — the receiver
// (controllers/normalize.controller.ts) turns this into a 400 with the
// message, so the sending SIEM's own webhook-delivery UI shows a clear
// failure instead of a silent drop.
export class ParseError extends Error {}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ParseError(`Missing or invalid required field "${field}"`);
  }
  return value;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
