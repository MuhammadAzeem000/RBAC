import { crowdstrikeParser } from "./crowdstrike.parser";
import { ParseError } from "./types";

describe("crowdstrikeParser", () => {
  it("maps a realistic detection webhook payload to the canonical shape", () => {
    const result = crowdstrikeParser.parse({
      detection_id: "ldt:abcdef1234567890:123456789",
      created_timestamp: "2026-08-28T10:00:00Z",
      max_severity: 80,
      max_severity_displayname: "High",
      device: { hostname: "WORKSTATION-01", local_ip: "192.168.1.50", external_ip: "203.0.113.10" },
      behaviors: [
        { ioc_type: "hash_sha256", ioc_value: "abc123def456", user_name: "jdoe" },
      ],
    });

    expect(result).toMatchObject({
      source: "crowdstrike",
      externalId: "ldt:abcdef1234567890:123456789",
      severity: "high",
      timestamp: "2026-08-28T10:00:00Z",
      rawRef: null,
    });
    expect(result.entities).toEqual(
      expect.arrayContaining([
        { type: "host", value: "WORKSTATION-01" },
        { type: "ip", value: "192.168.1.50" },
        { type: "ip", value: "203.0.113.10" },
        { type: "user", value: "jdoe" },
        { type: "file_hash", value: "abc123def456" },
      ]),
    );
  });

  it("falls back to the numeric severity scale when no displayname is present", () => {
    expect(crowdstrikeParser.parse({ detection_id: "d1", max_severity: 90 }).severity).toBe("critical");
    expect(crowdstrikeParser.parse({ detection_id: "d2", max_severity: 65 }).severity).toBe("high");
    expect(crowdstrikeParser.parse({ detection_id: "d3", max_severity: 40 }).severity).toBe("medium");
    expect(crowdstrikeParser.parse({ detection_id: "d4", max_severity: 5 }).severity).toBe("low");
  });

  it("throws ParseError when detection_id is missing", () => {
    expect(() => crowdstrikeParser.parse({})).toThrow(ParseError);
  });
});
