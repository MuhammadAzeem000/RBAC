import { sentinelParser } from "./sentinel.parser";
import { ParseError } from "./types";

describe("sentinelParser", () => {
  it("maps the Azure Monitor common alert schema to the canonical shape", () => {
    const result = sentinelParser.parse({
      schemaId: "azureMonitorCommonAlertSchema",
      data: {
        essentials: {
          severity: "Sev1",
          firedDateTime: "2026-08-28T10:00:00.000Z",
          originAlertId: "abcdef-1234-5678",
        },
        alertContext: {
          properties: {
            Account: "jdoe@contoso.com",
            IPAddress: "203.0.113.5",
            Host: "DESKTOP-ABC123",
          },
        },
      },
    });

    expect(result).toMatchObject({
      source: "sentinel",
      externalId: "abcdef-1234-5678",
      severity: "high",
      timestamp: "2026-08-28T10:00:00.000Z",
      rawRef: null,
    });
    expect(result.entities).toEqual(
      expect.arrayContaining([
        { type: "user", value: "jdoe@contoso.com" },
        { type: "ip", value: "203.0.113.5" },
        { type: "host", value: "DESKTOP-ABC123" },
      ]),
    );
  });

  it("maps every Sev level onto the canonical severity scale", () => {
    const severityOf = (sev: string) =>
      sentinelParser.parse({ data: { essentials: { severity: sev, originAlertId: "x" } } }).severity;
    expect(severityOf("Sev0")).toBe("critical");
    expect(severityOf("Sev1")).toBe("high");
    expect(severityOf("Sev2")).toBe("medium");
    expect(severityOf("Sev3")).toBe("low");
    expect(severityOf("Sev4")).toBe("low");
  });

  it("throws ParseError when data.essentials is missing", () => {
    expect(() => sentinelParser.parse({ data: {} })).toThrow(ParseError);
  });

  it("throws ParseError when originAlertId/alertId is missing", () => {
    expect(() => sentinelParser.parse({ data: { essentials: { severity: "Sev1" } } })).toThrow(ParseError);
  });
});
