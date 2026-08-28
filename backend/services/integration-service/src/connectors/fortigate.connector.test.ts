import { fortigateConnector } from "./fortigate.connector";
import { ConnectorActionFailure } from "./types";

// Same situation as qradar.connector.test.ts — no fixed public FortiGate
// instance to live-verify against, so the request/response handling is
// verified here against a mocked fetch instead.
function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as typeof fetch;
}

const credentials = { host: "https://fortigate.example.com", apiToken: "api-token" };

describe("fortigateConnector.test", () => {
  it("throws a non-retryable failure when apiToken is missing", async () => {
    await expect(fortigateConnector.actions.test({ credentials: { host: "x" }, params: {} })).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("succeeds and returns the system status payload", async () => {
    mockFetchOnce(200, { version: "v7.4.1", serial: "FGT-1" });
    const result = await fortigateConnector.actions.test({ credentials, params: {} });
    expect(result).toEqual({ result: { version: "v7.4.1", serial: "FGT-1" } });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://fortigate.example.com/api/v2/cmdb/system/status",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer api-token" }) }),
    );
  });

  it("classifies a 403 as a non-retryable authentication failure", async () => {
    mockFetchOnce(403, {});
    await expect(fortigateConnector.actions.test({ credentials, params: {} })).rejects.toMatchObject({
      retryable: false,
    });
  });
});

describe("fortigateConnector.blockIp", () => {
  it("requires an ip param", async () => {
    await expect(fortigateConnector.actions.blockIp({ credentials, params: {} })).rejects.toThrow(ConnectorActionFailure);
  });

  it("creates a firewall address object named after the blocked IP", async () => {
    mockFetchOnce(200, { status: "success" });
    await fortigateConnector.actions.blockIp({ credentials, params: { ip: "203.0.113.5" } });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({ name: "soar-block-203.0.113.5", type: "ipmask", subnet: "203.0.113.5 255.255.255.255" });
  });
});
