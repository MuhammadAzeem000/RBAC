import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { createTenantSchema, tenantListQuerySchema, updateTenantSchema } from "../interfaces/tenant";
import * as outboxService from "../services/outbox.service";
import * as tenantService from "../services/tenant.service";
import { publishEvent } from "../events/eventBus.service";
import { TENANT_CREATED_ROUTING_KEY } from "../events/topology";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid tenant id" });
    return null;
  }
  return id;
}

export async function getTenants(req: Request, res: Response) {
  const query = parseQuery(tenantListQuerySchema, req, res);
  if (!query) return;

  const result = await tenantService.getTenants(query);
  res.json(result);
}

export async function getTenantById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const tenant = await tenantService.getTenantById(id);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json(tenant);
}

export async function createTenant(req: Request, res: Response) {
  const result = createTenantSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tenantService.createTenant(result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "TENANT_CREATED",
      aggregateType: "TENANT",
      aggregateId: created.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "CREATE",
      resourceType: "TENANT",
      resourceId: created.id.toString(),
      payload: { slug: created.slug, name: created.name },
    });
    return created;
  });
  void publishEvent(TENANT_CREATED_ROUTING_KEY, { tenantId: tenant.id.toString(), slug: tenant.slug });
  res.status(201).json(tenant);
}

export async function updateTenant(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updateTenantSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const updated = await tenantService.updateTenant(id, result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "TENANT_UPDATED",
      aggregateType: "TENANT",
      aggregateId: updated.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "TENANT",
      resourceId: updated.id.toString(),
      payload: { name: updated.name, status: updated.status },
    });
    return updated;
  });
  res.json(tenant);
}
