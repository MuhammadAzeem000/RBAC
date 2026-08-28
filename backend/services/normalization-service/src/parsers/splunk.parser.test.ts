import { splunkParser } from "./splunk.parser";
import { ParseError } from "./types";

describe("splunkParser", () => {
  it("maps a realistic webhook alert-action payload to the canonical shape", () => {
    const result = splunkParser.parse({
      sid: "scheduler__admin__search__RMD5abcdef_at_1700000000_12345",
      search_name: "Suspicious outbound connection",
      results_link: "https://splunk.example.com/app/search/search",
      result: {
        _time: "2026-08-28T10:00:00.000+00:00",
        severity: "high",
        src_ip: "10.0.0.5",
        dest_ip: "8.8.8.8",
        host: "web-server-01",
        user: "jdoe",
      },
    });

    expect(result).toMatchObject({
      source: "splunk",
      externalId: "scheduler__admin__search__RMD5abcdef_at_1700000000_12345",
      severity: "high",
      timestamp: "2026-08-28T10:00:00.000+00:00",
      rawRef: "https://splunk.example.com/app/search/search",
    });
    expect(result.entities).toEqual(
      expect.arrayContaining([
        { type: "ip", value: "10.0.0.5" },
        { type: "ip", value: "8.8.8.8" },
        { type: "host", value: "web-server-01" },
        { type: "user", value: "jdoe" },
      ]),
    );
  });

  it("defaults severity to medium when the search has no severity field", () => {
    const result = splunkParser.parse({ sid: "sid-1", result: {} });
    expect(result.severity).toBe("medium");
  });

  it("maps a numeric urgency onto the canonical scale", () => {
    expect(splunkParser.parse({ sid: "sid-1", result: { urgency: 9 } }).severity).toBe("critical");
    expect(splunkParser.parse({ sid: "sid-2", result: { urgency: 1 } }).severity).toBe("low");
  });

  it("throws ParseError when sid is missing", () => {
    expect(() => splunkParser.parse({ result: {} })).toThrow(ParseError);
  });

  it("throws ParseError for a non-object payload", () => {
    expect(() => splunkParser.parse("not json")).toThrow(ParseError);
  });
});
