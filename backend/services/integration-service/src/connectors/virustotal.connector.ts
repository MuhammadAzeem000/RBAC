import { fetchWithTimeout } from "../lib/http";
import { ConnectorActionContext, ConnectorActionFailure, ConnectorActionSuccess, ConnectorDefinition } from "./types";

interface VtErrorBody {
  error?: { code?: string; message?: string };
}

interface VtObjectResponse {
  data?: {
    id: string;
    attributes?: {
      last_analysis_stats?: Record<string, number>;
      reputation?: number;
    };
  };
}

function requireApiKey(credentials: Record<string, unknown>): string {
  const apiKey = credentials.apiKey;
  if (typeof apiKey !== "string" || !apiKey) {
    throw new ConnectorActionFailure("VirusTotal credentials missing apiKey", false);
  }
  return apiKey;
}

// VirusTotal encodes errors in the HTTP status, unlike Slack — 429/5xx are
// transient (retry), everything else (400/401/403/404) is a deterministic
// failure that will never succeed on retry with the same request.
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function callVirusTotal(path: string, apiKey: string): Promise<VtObjectResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`https://www.virustotal.com/api/v3/${path}`, {
      headers: { "x-apikey": apiKey },
    });
  } catch (error) {
    throw new ConnectorActionFailure(
      `VirusTotal request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  if (!response.ok) {
    let message = `VirusTotal error (HTTP ${response.status})`;
    try {
      const body = (await response.json()) as VtErrorBody;
      if (body.error) message = `VirusTotal error: ${body.error.code} — ${body.error.message}`;
    } catch {
      // Body wasn't JSON (or was empty) — the generic status-based message stands.
    }
    throw new ConnectorActionFailure(message, isRetryableStatus(response.status));
  }

  return (await response.json()) as VtObjectResponse;
}

async function lookupIp(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const apiKey = requireApiKey(ctx.credentials);
  const ip = ctx.params.ip;
  if (typeof ip !== "string" || !ip) {
    throw new ConnectorActionFailure("lookupIp requires string param {ip}", false);
  }

  const body = await callVirusTotal(`ip_addresses/${encodeURIComponent(ip)}`, apiKey);
  return { result: { ip, stats: body.data?.attributes?.last_analysis_stats ?? null } };
}

async function lookupHash(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const apiKey = requireApiKey(ctx.credentials);
  const hash = ctx.params.hash;
  if (typeof hash !== "string" || !hash) {
    throw new ConnectorActionFailure("lookupHash requires string param {hash}", false);
  }

  const body = await callVirusTotal(`files/${encodeURIComponent(hash)}`, apiKey);
  return {
    result: {
      hash,
      stats: body.data?.attributes?.last_analysis_stats ?? null,
      reputation: body.data?.attributes?.reputation ?? null,
    },
  };
}

// A well-known, always-resolvable IP (Google DNS) purely to validate
// connectivity + credentials — same call shape as lookupIp, just with a
// fixed target so the test endpoint needs no caller-supplied param.
async function test(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  return lookupIp({ ...ctx, params: { ip: "8.8.8.8" } });
}

export const virustotalConnector: ConnectorDefinition = {
  key: "virustotal",
  name: "VirusTotal",
  type: "threat_intel",
  // Public/free-tier limit: 4 requests/minute, 500/day.
  rateLimit: { maxRequests: 4, windowMs: 60_000 },
  actions: { lookupIp, lookupHash, test },
};
