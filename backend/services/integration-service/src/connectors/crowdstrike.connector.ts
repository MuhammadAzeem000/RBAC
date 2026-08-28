import { fetchWithTimeout } from "../lib/http";
import { ConnectorActionContext, ConnectorActionFailure, ConnectorActionSuccess, ConnectorDefinition } from "./types";

// CrowdStrike Falcon's API (documented: https://falcon.crowdstrike.com/documentation) —
// OAuth2 client-credentials against a fixed, public cloud hostname (unlike
// QRadar/FortiGate, which are customer-hosted appliances with no fixed
// address). `cloudUrl` is still configurable (CrowdStrike has multiple
// regional clouds — us-1, us-2, eu-1, us-gov-1), defaulting to the most
// common one.
const DEFAULT_CLOUD_URL = "https://api.crowdstrike.com";

function requireCredentials(credentials: Record<string, unknown>): {
  clientId: string;
  clientSecret: string;
  cloudUrl: string;
} {
  const clientId = credentials.clientId;
  const clientSecret = credentials.clientSecret;
  if (typeof clientId !== "string" || !clientId) {
    throw new ConnectorActionFailure("CrowdStrike credentials missing clientId", false);
  }
  if (typeof clientSecret !== "string" || !clientSecret) {
    throw new ConnectorActionFailure("CrowdStrike credentials missing clientSecret", false);
  }
  const cloudUrl = typeof credentials.cloudUrl === "string" && credentials.cloudUrl ? credentials.cloudUrl : DEFAULT_CLOUD_URL;
  return { clientId, clientSecret, cloudUrl: cloudUrl.replace(/\/+$/, "") };
}

interface TokenResponse {
  access_token?: string;
  errors?: { message: string }[];
}

// The token fetch itself doubles as both auth AND the connectivity check —
// same shape as smtp.connector.ts's verify(), no separate "whoami" call
// needed. This is the one call in this connector reachable against a real,
// fixed public endpoint without a customer account — proves the request
// building and CrowdStrike's own error-shape parsing genuinely work, even
// with placeholder credentials (a real "invalid client" response comes
// back, not a network failure), matching the verification rigor Slack/
// VirusTotal got in Phase 3.
async function fetchAccessToken(clientId: string, clientSecret: string, cloudUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${cloudUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
    });
  } catch (error) {
    throw new ConnectorActionFailure(
      `CrowdStrike token request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  const body = (await response.json().catch(() => ({}))) as TokenResponse;

  if (response.status === 401 || response.status === 403) {
    throw new ConnectorActionFailure(`CrowdStrike authentication failed: ${body.errors?.[0]?.message ?? "invalid credentials"}`, false);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new ConnectorActionFailure(`CrowdStrike server error (HTTP ${response.status})`, true);
  }
  if (!response.ok || !body.access_token) {
    throw new ConnectorActionFailure(`CrowdStrike token request error: ${body.errors?.[0]?.message ?? `HTTP ${response.status}`}`, false);
  }

  return body.access_token;
}

// Network containment — CrowdStrike's own name for isolating a host from
// the network while keeping the Falcon sensor's management channel alive,
// the signature EDR "isolate host" SOAR action (documented: Falcon
// Real Time Response / Hosts API, devices-actions/v2).
async function containHost(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { clientId, clientSecret, cloudUrl } = requireCredentials(ctx.credentials);
  const deviceId = ctx.params.deviceId;
  if (typeof deviceId !== "string" || !deviceId) {
    throw new ConnectorActionFailure("containHost requires string param {deviceId}", false);
  }

  const accessToken = await fetchAccessToken(clientId, clientSecret, cloudUrl);

  let response: Response;
  try {
    response = await fetchWithTimeout(`${cloudUrl}/devices/entities/devices-actions/v2?action_name=contain`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [deviceId] }),
    });
  } catch (error) {
    throw new ConnectorActionFailure(
      `CrowdStrike containment request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  if (response.status === 429 || response.status >= 500) {
    throw new ConnectorActionFailure(`CrowdStrike server error (HTTP ${response.status})`, true);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new ConnectorActionFailure(`CrowdStrike containment failed (HTTP ${response.status}): ${text}`, false);
  }

  return { result: { deviceId, action: "contain" } };
}

async function test(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { clientId, clientSecret, cloudUrl } = requireCredentials(ctx.credentials);
  await fetchAccessToken(clientId, clientSecret, cloudUrl);
  return { result: { cloudUrl } };
}

export const crowdstrikeConnector: ConnectorDefinition = {
  key: "crowdstrike",
  name: "CrowdStrike Falcon",
  type: "edr",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  actions: { containHost, test },
};
