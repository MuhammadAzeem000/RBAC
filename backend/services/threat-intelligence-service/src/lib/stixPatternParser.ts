// Extracts a fast-lookup (iocType, iocValue) pair from a STIX 2.1 Indicator
// pattern (STIX 2.1 §9, the "Indicator Pattern" grammar) — but only for the
// common case of a single equality comparison, e.g.
// "[ipv4-addr:value = '1.2.3.4']" or "[file:hashes.'SHA-256' = 'abcd...']".
// Compound/boolean patterns (AND/OR, multiple observation expressions) are
// intentionally left unparsed (returns null) — they don't reduce to one
// "value" a lookup query can index against; the full pattern remains
// queryable via StixObject.pattern / .raw.
export interface ParsedIocPattern {
  iocType: string;
  iocValue: string;
}

// object-path:property = 'value' | "value" — the single-comparison-expression
// case. Object-path may itself contain dots (e.g. file:hashes.'SHA-256').
const SIMPLE_EQUALITY_PATTERN = /^\[\s*([a-zA-Z0-9_-]+:[a-zA-Z0-9_.'"-]+)\s*=\s*'([^']*)'\s*\]$/;

export function parseStixPattern(pattern: string | undefined | null): ParsedIocPattern | null {
  if (!pattern) return null;

  const trimmed = pattern.trim();
  const match = SIMPLE_EQUALITY_PATTERN.exec(trimmed);
  if (!match) return null;

  const [, objectPath, value] = match;
  if (!value) return null;

  return { iocType: objectPath, iocValue: value };
}
