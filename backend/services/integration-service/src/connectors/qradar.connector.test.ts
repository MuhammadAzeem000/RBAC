import { qradarConnector } from "./qradar.connector";
import { ConnectorActionFailure } from "./types";

// No fixed public QRadar instance exists to live-verify against (every
// deployment is a customer's own appliance — see qradar.connector.ts's own
// comment), so this connector's request/response handling is verified here
// against a mocked fetch instead.
function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as typeof fetch;
}

const credentials = { host: "https://qradar.example.com", token: "sec-token" };

describe("qradarConnector.test", () => {
  it("throws a non-retryable failure when host is missing", async () => {
    await expect(qradarConnector.actions.test({ credentials: { token: "x" }, params: {} })).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("succeeds and returns the /api/system/about payload", async () => {
    mockFetchOnce(200, { id: 1, buildVersion: "7.5" });
    const result = await qradarConnector.actions.test({ credentials, params: {} });
    expect(result).toEqual({ result: { about: { id: 1, buildVersion: "7.5" } } });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://qradar.example.com/api/system/about",
      expect.objectContaining({ headers: expect.objectContaining({ SEC: "sec-token" }) }),
    );
  });

  it("classifies a 401 as a non-retryable authentication failure", async () => {
    mockFetchOnce(401, { message: "invalid token" });
    await expect(qradarConnector.actions.test({ credentials, params: {} })).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("classifies a 500 as retryable", async () => {
    mockFetchOnce(500, { message: "internal error" });
    await expect(qradarConnector.actions.test({ credentials, params: {} })).rejects.toMatchObject({
      retryable: true,
    });
  });
});

describe("qradarConnector.searchOffenses", () => {
  it("requires a sourceIp param", async () => {
    await expect(qradarConnector.actions.searchOffenses({ credentials, params: {} })).rejects.toThrow(ConnectorActionFailure);
  });

  it("filters offenses by the given sourceIp", async () => {
    mockFetchOnce(200, [{ id: 42, description: "Suspicious traffic", severity: 7, offense_source: "10.0.0.5", status: "OPEN" }]);
    const result = await qradarConnector.actions.searchOffenses({ credentials, params: { sourceIp: "10.0.0.5" } });
    expect(result.result.offenses).toHaveLength(1);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/siem/offenses?filter=");
    expect(decodeURIComponent(url)).toContain('offense_source="10.0.0.5"');
  });
});
