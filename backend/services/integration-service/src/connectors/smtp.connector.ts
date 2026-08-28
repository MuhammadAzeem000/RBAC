import nodemailer from "nodemailer";
import { ConnectorActionContext, ConnectorActionFailure, ConnectorActionSuccess, ConnectorDefinition } from "./types";

// Per-tenant SMTP credentials (host/port/auth/from) — a genuinely different
// shape from notification-service's own mailer.ts, which sends from one
// fixed, server-wide SMTP config (Mailpit in dev). This connector builds a
// fresh transporter per call from whichever tenant's stored, encrypted
// credentials are active — same "own judgement per connector" pattern as
// slack.connector.ts's botToken / virustotal.connector.ts's apiKey.
interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

function parseCredentials(credentials: Record<string, unknown>): SmtpCredentials {
  const host = credentials.host;
  const from = credentials.from;
  if (typeof host !== "string" || !host) {
    throw new ConnectorActionFailure("SMTP credentials missing host", false);
  }
  if (typeof from !== "string" || !from) {
    throw new ConnectorActionFailure("SMTP credentials missing from", false);
  }

  const rawPort = credentials.port;
  const port = typeof rawPort === "number" ? rawPort : typeof rawPort === "string" ? Number(rawPort) : NaN;
  if (!Number.isFinite(port) || port <= 0) {
    throw new ConnectorActionFailure("SMTP credentials missing or invalid port", false);
  }

  const secure = credentials.secure === true || credentials.secure === "true";
  const user = typeof credentials.user === "string" && credentials.user ? credentials.user : undefined;
  const pass = typeof credentials.pass === "string" && credentials.pass ? credentials.pass : undefined;

  return { host, port, secure, user, pass, from };
}

function buildTransporter(creds: SmtpCredentials) {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: creds.user && creds.pass ? { user: creds.user, pass: creds.pass } : undefined,
  });
}

async function sendEmail(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const creds = parseCredentials(ctx.credentials);
  const { to, subject, body } = ctx.params;
  if (typeof to !== "string" || typeof subject !== "string" || typeof body !== "string") {
    throw new ConnectorActionFailure("sendEmail requires string params {to, subject, body}", false);
  }

  try {
    const info = await buildTransporter(creds).sendMail({ from: creds.from, to, subject, text: body });
    return { result: { messageId: info.messageId } };
  } catch (error) {
    // A connection/auth failure here is plausibly transient (SMTP server
    // temporarily down, network blip) — unlike a malformed-params error
    // above, this is worth letting Temporal's retry policy handle.
    throw new ConnectorActionFailure(`SMTP send failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

// Verifies the connection/auth without sending anything — SMTP has no
// "whoami" endpoint the way Slack/VirusTotal do, but nodemailer's verify()
// (a real SMTP handshake against the configured server) is the equivalent:
// it proves the credentials actually work, not just that they're present.
async function test(ctx: ConnectorActionContext): Promise<ConnectorActionSuccess> {
  const creds = parseCredentials(ctx.credentials);
  try {
    await buildTransporter(creds).verify();
  } catch (error) {
    throw new ConnectorActionFailure(`SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`, true);
  }
  return { result: { host: creds.host, port: creds.port, secure: creds.secure } };
}

export const smtpConnector: ConnectorDefinition = {
  key: "smtp",
  name: "Email (SMTP)",
  type: "notification",
  // No universal published SMTP rate limit (unlike Slack/VirusTotal's own
  // documented ones) — a conservative default to avoid a misconfigured
  // playbook step hammering a mail server, not a vendor-published number.
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  actions: { sendEmail, test },
};
