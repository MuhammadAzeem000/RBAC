import { fetchWithTimeout } from "../lib/http";
import { ConnectorActionContext, ConnectorActionFailure, ConnectorActionSuccess, ConnectorDefinition } from "./types";

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
  team?: string;
  user?: string;
}

// Slack returns HTTP 200 even on logical failures — the "ok" field is
// authoritative, not the status code. These error codes are deterministic
// (bad token, wrong scope, bot not in channel) and will never succeed on
// retry; anything else (rare, but Slack doesn't document an exhaustive
// list) is treated as possibly-transient.
const NON_RETRYABLE_SLACK_ERRORS = new Set([
  "invalid_auth",
  "not_authed",
  "missing_scope",
  "channel_not_found",
  "not_in_channel",
  "account_inactive",
  "token_revoked",
  "invalid_arguments",
]);

function requireBotToken(credentials: Record<string, unknown>): string {
  const botToken = credentials.botToken;
  if (typeof botToken !== "string" || !botToken) {
    throw new ConnectorActionFailure("Slack credentials missing botToken", false);
  }
  return botToken;
}

async function callSlack(method: string, botToken: string, body?: Record<string, unknown>): Promise<SlackApiResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ConnectorActionFailure(`Slack request failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }

  if (response.status === 429) throw new ConnectorActionFailure("Slack rate limit exceeded", true);
  if (response.status >= 500) throw new ConnectorActionFailure(`Slack server error (${response.status})`, true);

  const parsed = (await response.json()) as SlackApiResponse;
  if (!parsed.ok) {
    const retryable = !NON_RETRYABLE_SLACK_ERRORS.has(parsed.error ?? "");
    throw new ConnectorActionFailure(`Slack error: ${parsed.error ?? "unknown"}`, retryable);
  }
  return parsed;
}

async function postMessage(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const botToken = requireBotToken(ctx.credentials);
  const { channel, text } = ctx.params;
  if (typeof channel !== "string" || typeof text !== "string") {
    throw new ConnectorActionFailure("postMessage requires string params {channel, text}", false);
  }

  const body = await callSlack("chat.postMessage", botToken, { channel, text });
  return { result: { ts: body.ts, channel: body.channel } };
}

async function test(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const botToken = requireBotToken(ctx.credentials);
  const body = await callSlack("auth.test", botToken);
  return { result: { team: body.team, user: body.user } };
}

export const slackConnector: ConnectorDefinition = {
  key: "slack",
  name: "Slack",
  type: "collaboration",
  // Slack's Tier 3 web API limit is roughly 50/min per workspace; keeping
  // this connector well under it (1/sec) leaves headroom for other API
  // calls the same bot token might be making.
  rateLimit: { maxRequests: 1, windowMs: 1000 },
  actions: { postMessage, test },
};
