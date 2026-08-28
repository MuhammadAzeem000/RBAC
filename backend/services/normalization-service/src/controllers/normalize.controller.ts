import { Request, Response } from "express";
import { HttpError } from "../middlewares/errorHandler";
import { getParser } from "../parsers/registry";
import { ParseError } from "../parsers/types";
import * as webhookSourceService from "../services/webhookSource.service";
import { ingestNormalizedAlert } from "../services/alertIngestionClient.service";
import { writeOutboxEvent } from "../services/outbox.service";

// req.params values are typed string | string[] by @types/express (to
// account for wildcard/regex route segments) even though a plain named
// segment is always a single string at runtime.
function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

async function recordNormalizedEvent(
  tenantId: bigint,
  sourceId: bigint,
  vendor: string,
  action: "INGESTED" | "PARSE_FAILED",
  metadata: Record<string, unknown>,
): Promise<void> {
  const db = webhookSourceService.scopedDb(tenantId);
  await db.$transaction((tx) =>
    writeOutboxEvent(tx, {
      tenantId,
      eventType: "ALERT_NORMALIZED",
      aggregateType: "WEBHOOK_SOURCE",
      aggregateId: sourceId.toString(),
      actorId: null,
      actorType: "SYSTEM",
      action,
      resourceType: "WEBHOOK_SOURCE",
      resourceId: sourceId.toString(),
      metadata: { vendor, ...metadata },
    }),
  );
}

// No `authenticate`/`tenantContext` — a vendor SIEM/EDR can't send a
// ResponderX JWT. The URL token IS the credential; it resolves the tenant
// (see webhookSource.service.ts's lookupByToken, a deliberately
// non-tenant-scoped global lookup, since the tenant isn't known yet).
export async function receiveWebhook(req: Request, res: Response) {
  const vendor = routeParam(req.params.vendor);
  const token = routeParam(req.params.token);

  const source = await webhookSourceService.lookupByToken(token);
  if (!source) {
    throw new HttpError(404, "Unknown webhook token");
  }
  if (source.vendor !== vendor) {
    throw new HttpError(400, `This token is configured for vendor "${source.vendor}", not "${vendor}"`);
  }

  const parser = getParser(vendor);
  if (!parser) {
    throw new HttpError(400, `Unknown vendor "${vendor}"`);
  }

  let alert;
  try {
    alert = parser.parse(req.body);
  } catch (error) {
    const message = error instanceof ParseError ? error.message : "Failed to parse payload";
    await recordNormalizedEvent(source.tenantId, source.id, vendor, "PARSE_FAILED", { error: message });
    throw new HttpError(400, message);
  }

  await ingestNormalizedAlert(source.tenantId.toString(), alert);
  await recordNormalizedEvent(source.tenantId, source.id, vendor, "INGESTED", {
    source: alert.source,
    externalId: alert.externalId,
  });

  res.status(202).json({ status: "accepted" });
}
