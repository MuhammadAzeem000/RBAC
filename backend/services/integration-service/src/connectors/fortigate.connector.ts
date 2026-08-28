import { fetchWithTimeout } from "../lib/http";
import { ConnectorActionContext, ConnectorActionFailure, ConnectorActionSuccess, ConnectorDefinition } from "./types";

// FortiGate's FortiOS REST API (documented: Fortinet FortiOS REST API
// reference), authenticated with a per-appliance API token. Like QRadar,
// there's no fixed public SaaS hostname — every FortiGate is a customer's
// own firewall appliance, so `host` is part of the credentials. No real
// instance to live-verify against here either — see qradar.connector.ts's
// comment for the same reasoning; verified via unit tests instead (see
// fortigate.connector.test.ts).
function requireCredentials(credentials: Record<string, unknown>): { host: string; apiToken: string } {
  const host = credentials.host;
  const apiToken = credentials.apiToken;
  if (typeof host !== "string" || !host) {
    throw new ConnectorActionFailure("FortiGate credentials missing host", false);
  }
  if (typeof apiToken !== "string" || !apiToken) {
    throw new ConnectorActionFailure("FortiGate credentials missing apiToken", false);
  }
  return { host: host.replace(/\/+$/, ""), apiToken };
}

async function callFortiGate(
  host: string,
  apiToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${host}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch (error) {
    throw new ConnectorActionFailure(
      `FortiGate request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ConnectorActionFailure(`FortiGate authentication failed (HTTP ${response.status})`, false);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new ConnectorActionFailure(`FortiGate server error (HTTP ${response.status})`, true);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new ConnectorActionFailure(`FortiGate error (HTTP ${response.status}): ${body}`, false);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

// Creates a firewall address object for the given IP — the standard
// FortiGate building block for a "block this IP" playbook step (the SOC
// would separately maintain a deny policy referencing an address group this
// object gets added to; creating the address object itself is the atomic,
// idempotent-by-name action a connector step should perform).
async function blockIp(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { host, apiToken } = requireCredentials(ctx.credentials);
  const ip = ctx.params.ip;
  if (typeof ip !== "string" || !ip) {
    throw new ConnectorActionFailure("blockIp requires string param {ip}", false);
  }

  const body = await callFortiGate(host, apiToken, "/api/v2/cmdb/firewall/address", {
    method: "POST",
    body: JSON.stringify({ name: `soar-block-${ip}`, type: "ipmask", subnet: `${ip} 255.255.255.255` }),
  });
  return { result: body };
}

async function test(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { host, apiToken } = requireCredentials(ctx.credentials);
  const status = await callFortiGate(host, apiToken, "/api/v2/cmdb/system/status");
  return { result: status };
}

export const fortigateConnector: ConnectorDefinition = {
  key: "fortigate",
  name: "Fortinet FortiGate",
  type: "network_security",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  actions: { blockIp, test },
};
