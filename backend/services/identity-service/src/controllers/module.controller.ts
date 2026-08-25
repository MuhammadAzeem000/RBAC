import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { createModuleSchema, moduleListQuerySchema, updateModuleSchema } from "../interfaces/module";
import * as moduleService from "../services/module.service";
import * as outboxService from "../services/outbox.service";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid module id" });
    return null;
  }
  return id;
}

export async function getModules(req: Request, res: Response) {
  const query = parseQuery(moduleListQuerySchema, req, res);
  if (!query) return;

  const result = await moduleService.getModules(query);
  res.json(result);
}

export async function getModuleById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const module = await moduleService.getModuleById(id);
  if (!module) {
    res.status(404).json({ error: "Module not found" });
    return;
  }
  res.json(module);
}

export async function createModule(req: Request, res: Response) {
  const result = createModuleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const module = await prisma.$transaction(async (tx) => {
    const created = await moduleService.createModule(result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "MODULE_CREATED",
      aggregateType: "MODULE",
      aggregateId: created.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "CREATE",
      resourceType: "MODULE",
      resourceId: created.id.toString(),
      payload: { name: created.name },
    });
    return created;
  });
  res.status(201).json(module);
}

export async function updateModule(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updateModuleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const module = await prisma.$transaction(async (tx) => {
    const updated = await moduleService.updateModule(id, result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "MODULE_UPDATED",
      aggregateType: "MODULE",
      aggregateId: updated.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "MODULE",
      resourceId: updated.id.toString(),
      payload: { name: updated.name },
    });
    return updated;
  });
  res.json(module);
}

export async function deleteModule(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (await moduleService.moduleHasPermissions(id)) {
    res.status(409).json({
      error: "This module still has permissions defined for it. Remove them before deleting the module.",
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await moduleService.deleteModule(id, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "MODULE_DELETED",
      aggregateType: "MODULE",
      aggregateId: id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "DELETE",
      resourceType: "MODULE",
      resourceId: id.toString(),
    });
  });
  res.status(204).send();
}
