import { genericParser } from "./generic.parser";
import { ParseError } from "./types";

describe("genericParser", () => {
  it("passes through an already-canonical-ish payload", () => {
    const result = genericParser.parse({
      source: "manual-test",
      externalId: "evt-1",
      severity: "CRITICAL",
      timestamp: "2026-08-28T10:00:00.000Z",
      rawRef: "https://example.com/case/1",
      entities: [{ type: "ip", value: "10.0.0.1" }, { type: "not-a-real-type", value: "ignored" }],
    });

    expect(result).toEqual({
      source: "manual-test",
      externalId: "evt-1",
      severity: "critical",
      timestamp: "2026-08-28T10:00:00.000Z",
      rawRef: "https://example.com/case/1",
      entities: [{ type: "ip", value: "10.0.0.1" }],
    });
  });

  it("defaults severity to medium and rawRef to null when absent", () => {
    const result = genericParser.parse({ source: "x", externalId: "y" });
    expect(result.severity).toBe("medium");
    expect(result.rawRef).toBeNull();
  });

  it("throws ParseError when source or externalId is missing", () => {
    expect(() => genericParser.parse({ externalId: "y" })).toThrow(ParseError);
    expect(() => genericParser.parse({ source: "x" })).toThrow(ParseError);
  });
});
