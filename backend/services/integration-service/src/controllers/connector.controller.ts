import { Request, Response } from "express";
import { z } from "zod";
import { CONNECTOR_REGISTRY, getConnectorDefinition } from "../connectors/registry";
import { ConnectorActionFailure } from "../connectors/types";
import { Prisma } from "../generated/prisma/client";
import { decryptCredential, encryptCredential } from "../lib/crypto";
import { checkRateLimit, RateLimitExceededError } from "../lib/rateLimiter";
import * as outboxService from "../services/outbox.service";
import { parseBody } from "../utils";

// req.params values are typed string | string[] by @types/express (to
// account for wildcard/regex route segments) even though a plain named
// segment like ":key" is always a single string at runtime — every route
// here uses only named segments, so this is a safe, standard narrowing.
function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

const setCredentialsSchema = z.object({
  credential: z.record(z.string(), z.unknown()),
});

const executeActionSchema = z.object({
  tenantId: z.string(), // already consumed by requireServiceToken, re-validated here for shape
  params: z.record(z.string(), z.unknown()).default({}),
});

// Every tenant sees the full connector catalog, not just the ones they've
// configured — a Connector row is lazily created (disabled, no credential)
// the first time it's looked up for a tenant, then flips to enabled once
// credentials are set. Mirrors ensureModuleSeeded's find-or-create idiom.
async function ensureConnectorRow(db: Request["db"], tenantId: bigint, key: string) {
  const definition = getConnectorDefinition(key);
  if (!definition) return null;

  return db.connector.upsert({
    where: { tenantId_key: { tenantId, key } },
    // Keeps name/type in sync if the registry's own definition ever
    // changes — not a true no-op update, but idempotent either way.
    update: { name: definition.name, type: definition.type },
    create: { tenantId, key, name: definition.name, type: definition.type, status: "disabled" },
    include: { credential: true },
  });
}

export async function listConnectors(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  const rows = await Promise.all(
    Object.keys(CONNECTOR_REGISTRY).map((key) => ensureConnectorRow(req.db, tenantId, key)),
  );

  res.json({
    data: rows.filter(Boolean).map((row) => ({
      key: row!.key,
      name: row!.name,
      type: row!.type,
      status: row!.status,
      credentialConfigured: row!.credential !== null,
    })),
  });
}

export async function setCredentials(req: Request, res: Response) {
  const key = routeParam(req.params.key);
  const definition = getConnectorDefinition(key);
  if (!definition) {
    res.status(404).json({ error: `Unknown connector "${key}"` });
    return;
  }

  const body = parseBody(setCredentialsSchema, req, res);
  if (!body) return;

  const tenantId = req.auth!.tenantId;
  const connector = await ensureConnectorRow(req.db, tenantId, key);
  const encryptedSecret = encryptCredential(body.credential);

  await req.db.$transaction(async (tx) => {
    await tx.connectorCredential.upsert({
      where: { connectorId: connector!.id },
      update: { encryptedSecret },
      create: { tenantId, connectorId: connector!.id, encryptedSecret },
    });
    await tx.connector.update({ where: { id: connector!.id }, data: { status: "enabled" } });

    await outboxService.writeOutboxEvent(tx, {
      tenantId,
      eventType: "CONNECTOR_CREDENTIALS_SET",
      aggregateType: "CONNECTOR",
      aggregateId: connector!.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "CONNECTOR",
      resourceId: connector!.id.toString(),
      metadata: { key },
      // Never the secret itself — only that a credential was set.
    });
  });

  res.status(204).send();
}

// Shared by both POST /:key/test (human-facing, via requireConnectorPermission)
// and POST /:key/actions/:action (machine-facing, via requireServiceToken) —
// same execution path either way: rate-limit, decrypt credentials, invoke the
// handler, record an ActionResult + audit outbox event for every attempt.
async function executeConnectorAction(
  req: Request,
  res: Response,
  key: string,
  actionName: string,
  params: Record<string, unknown>,
) {
  const definition = getConnectorDefinition(key);
  if (!definition) {
    res.status(404).json({ error: `Unknown connector "${key}"` });
    return;
  }
  const handler = definition.actions[actionName];
  if (!handler) {
    res.status(404).json({ error: `Unknown action "${actionName}" for connector "${key}"` });
    return;
  }

  const tenantId = req.auth!.tenantId;
  const connector = await req.db.connector.findFirst({ where: { tenantId, key }, include: { credential: true } });
  if (!connector?.credential) {
    res.status(409).json({ error: `Connector "${key}" has no credentials configured` });
    return;
  }

  try {
    checkRateLimit(key, definition.rateLimit.maxRequests, definition.rateLimit.windowMs);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      res.status(429).json({ ok: false, error: { message: error.message, retryable: true } });
      return;
    }
    throw error;
  }

  const requestRef =
    (typeof params.channel === "string" && params.channel) ||
    (typeof params.ip === "string" && params.ip) ||
    (typeof params.hash === "string" && params.hash) ||
    null;

  const credentials = decryptCredential(connector.credential.encryptedSecret);

  try {
    const { result } = await handler({ credentials, params });

    await req.db.$transaction(async (tx) => {
      await tx.actionResult.create({
        data: {
          tenantId,
          connector: key,
          action: actionName,
          requestRef,
          status: "succeeded",
          result: result as Prisma.InputJsonValue,
        },
      });
      await outboxService.writeOutboxEvent(tx, {
        tenantId,
        eventType: "CONNECTOR_ACTION_SUCCEEDED",
        aggregateType: "CONNECTOR",
        aggregateId: connector.id.toString(),
        actorId: req.auth!.userId === 0n ? null : req.auth!.userId.toString(),
        action: "EXECUTE",
        resourceType: "CONNECTOR_ACTION",
        resourceId: `${key}.${actionName}`,
        metadata: { requestRef },
      });
    });

    res.json({ ok: true, result });
  } catch (error) {
    const failure =
      error instanceof ConnectorActionFailure
        ? error
        : new ConnectorActionFailure(error instanceof Error ? error.message : String(error), true);

    await req.db.$transaction(async (tx) => {
      await tx.actionResult.create({
        data: {
          tenantId,
          connector: key,
          action: actionName,
          requestRef,
          status: "failed",
          error: failure.message,
          retryable: failure.retryable,
        },
      });
      await outboxService.writeOutboxEvent(tx, {
        tenantId,
        eventType: "CONNECTOR_ACTION_FAILED",
        aggregateType: "CONNECTOR",
        aggregateId: connector.id.toString(),
        actorId: req.auth!.userId === 0n ? null : req.auth!.userId.toString(),
        action: "EXECUTE",
        resourceType: "CONNECTOR_ACTION",
        resourceId: `${key}.${actionName}`,
        metadata: { requestRef, error: failure.message, retryable: failure.retryable },
      });
    });

    res.json({ ok: false, error: { message: failure.message, retryable: failure.retryable } });
  }
}

export async function testConnector(req: Request, res: Response) {
  await executeConnectorAction(req, res, routeParam(req.params.key), "test", {});
}

export async function executeConnectorActionRoute(req: Request, res: Response) {
  const body = parseBody(executeActionSchema, req, res);
  if (!body) return;
  await executeConnectorAction(req, res, routeParam(req.params.key), routeParam(req.params.action), body.params);
}
