import { fetchWithTimeout } from "../lib/http";
import { ConnectorActionContext, ConnectorActionFailure, ConnectorActionSuccess, ConnectorDefinition } from "./types";

// IBM QRadar's REST API (documented: IBM QRadar SIEM API Guide). Unlike
// Slack/VirusTotal/CrowdStrike/Defender, QRadar has no fixed public SaaS
// hostname — every deployment is a customer's own on-prem or cloud
// appliance, so `host` is part of the credentials, not a constant. This
// means (unlike this project's earlier connectors) there is no real
// instance to live-verify against without a customer's own QRadar console —
// verified here via unit tests of the request/response handling instead
// (see qradar.connector.test.ts), same rigor gap flagged when SIEM/EDR
// connectors were originally deferred in Phase 5's planning.
interface QRadarOffense {
  id: number;
  description: string;
  severity: number;
  offense_source: string;
  status: string;
}

function requireCredentials(credentials: Record<string, unknown>): { host: string; token: string } {
  const host = credentials.host;
  const token = credentials.token;
  if (typeof host !== "string" || !host) {
    throw new ConnectorActionFailure("QRadar credentials missing host", false);
  }
  if (typeof token !== "string" || !token) {
    throw new ConnectorActionFailure("QRadar credentials missing token", false);
  }
  return { host: host.replace(/\/+$/, ""), token };
}

async function callQRadar(host: string, token: string, path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${host}${path}`, {
      headers: {
        // QRadar's own auth header (a generated "Authorization Token"), not
        // a Bearer token — this is the documented header name, not a typo.
        SEC: token,
        Version: "20.0",
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new ConnectorActionFailure(`QRadar request failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ConnectorActionFailure(`QRadar authentication failed (HTTP ${response.status})`, false);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new ConnectorActionFailure(`QRadar server error (HTTP ${response.status})`, true);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new ConnectorActionFailure(`QRadar error (HTTP ${response.status}): ${body}`, false);
  }

  return response.json();
}

// Offenses are QRadar's own aggregated-alert concept — searching by a
// source IP is the most common enrichment a playbook step would want
// ("has this indicator triggered anything in the SIEM").
async function searchOffenses(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { host, token } = requireCredentials(ctx.credentials);
  const sourceIp = ctx.params.sourceIp;
  if (typeof sourceIp !== "string" || !sourceIp) {
    throw new ConnectorActionFailure("searchOffenses requires string param {sourceIp}", false);
  }

  const filter = encodeURIComponent(`offense_source="${sourceIp}"`);
  const offenses = (await callQRadar(host, token, `/api/siem/offenses?filter=${filter}`)) as QRadarOffense[];
  return { result: { offenses } };
}

async function test(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const { host, token } = requireCredentials(ctx.credentials);
  const about = await callQRadar(host, token, "/api/system/about");
  return { result: { about } };
}

export const qradarConnector: ConnectorDefinition = {
  key: "qradar",
  name: "IBM QRadar",
  type: "siem",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  actions: { searchOffenses, test },
};
