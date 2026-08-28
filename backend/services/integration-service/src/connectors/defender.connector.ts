import { fetchWithTimeout } from "../lib/http";
import { ConnectorActionContext, ConnectorActionFailure, ConnectorActionSuccess, ConnectorDefinition } from "./types";

// Microsoft Defender for Endpoint (documented: Microsoft Defender for
// Endpoint API, https://learn.microsoft.com/microsoft-365/security/defender-endpoint/api).
// OAuth2 client-credentials against Azure AD's own fixed, public hostname
// (login.microsoftonline.com) then calls Defender's fixed, public API
// hostname (api.securitycenter.microsoft.com) — like crowdstrike.connector.ts,
// both are reachable without a customer account, so the request/error
// handling here IS live-verifiable with placeholder credentials (a real
// AADSTS error comes back), unlike QRadar/FortiGate's customer-hosted
// appliances.
const AAD_TOKEN_URL = (tenantId: string) => `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
const DEFENDER_API_URL = "https://api.securitycenter.microsoft.com";

function requireCredentials(credentials: Record<string, unknown>): {
  tenantId: string;
  clientId: string;
  clientSecret: string;
} {
  const tenantId = credentials.tenantId;
  const clientId = credentials.clientId;
  const clientSecret = credentials.clientSecret;
  if (typeof tenantId !== "string" || !tenantId) {
    throw new ConnectorActionFailure("Microsoft Defender credentials missing tenantId", false);
  }
  if (typeof clientId !== "string" || !clientId) {
    throw new ConnectorActionFailure("Microsoft Defender credentials missing clientId", false);
  }
  if (typeof clientSecret !== "string" || !clientSecret) {
    throw new ConnectorActionFailure("Microsoft Defender credentials missing clientSecret", false);
  }
  return { tenantId, clientId, clientSecret };
}

interface AadTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

// Same "token fetch doubles as the connectivity/auth check" shape as
// crowdstrike.connector.ts's fetchAccessToken.
async function fetchAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithTimeout(AAD_TOKEN_URL(tenantId), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: `${DEFENDER_API_URL}/.default`,
      }),
    });
  } catch (error) {
    throw new ConnectorActionFailure(
      `Microsoft Defender token request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  const body = (await response.json().catch(() => ({}))) as AadTokenResponse;

  if (response.status === 400 || response.status === 401) {
    throw new ConnectorActionFailure(
      `Microsoft Defender authentication failed: ${body.error_description ?? body.error ?? "invalid credentials"}`,
      false,
    );
  }
  if (response.status === 429 || response.status >= 500) {
    throw new ConnectorActionFailure(`Microsoft Defender server error (HTTP ${response.status})`, true);
  }
  if (!response.ok || !body.access_token) {
    throw new ConnectorActionFailure(`Microsoft Defender token request error: ${body.error_description ?? `HTTP ${response.status}`}`, false);
  }

  return body.access_token;
}

// Machine isolation — Defender's own name for the signature EDR "isolate
// host" SOAR action (documented: Isolate machine API, POST
// /api/machines/{id}/isolate), the direct counterpart to
// crowdstrike.connector.ts's containHost.
async function isolateMachine(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { tenantId, clientId, clientSecret } = requireCredentials(ctx.credentials);
  const machineId = ctx.params.machineId;
  if (typeof machineId !== "string" || !machineId) {
    throw new ConnectorActionFailure("isolateMachine requires string param {machineId}", false);
  }

  const accessToken = await fetchAccessToken(tenantId, clientId, clientSecret);

  let response: Response;
  try {
    response = await fetchWithTimeout(`${DEFENDER_API_URL}/api/machines/${encodeURIComponent(machineId)}/isolate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Comment: "Isolated by ResponderX playbook", IsolationType: "Full" }),
    });
  } catch (error) {
    throw new ConnectorActionFailure(
      `Microsoft Defender isolation request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  if (response.status === 429 || response.status >= 500) {
    throw new ConnectorActionFailure(`Microsoft Defender server error (HTTP ${response.status})`, true);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new ConnectorActionFailure(`Microsoft Defender isolation failed (HTTP ${response.status}): ${text}`, false);
  }

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { result: { machineId, action: body } };
}

async function test(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { tenantId, clientId, clientSecret } = requireCredentials(ctx.credentials);
  await fetchAccessToken(tenantId, clientId, clientSecret);
  return { result: { tenantId } };
}

export const defenderConnector: ConnectorDefinition = {
  key: "defender",
  name: "Microsoft Defender for Endpoint",
  type: "edr",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  actions: { isolateMachine, test },
};
