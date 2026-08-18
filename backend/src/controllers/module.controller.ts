import { Request, Response } from "express";
import { z } from "zod";
import { createModuleSchema, moduleListQuerySchema, updateModuleSchema } from "../interfaces/module";
import * as auditLogService from "../services/auditLog.service";
import * as moduleService from "../services/module.service";
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

  const module = await moduleService.createModule(result.data);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "module.create",
    targetType: "module",
    targetId: module.id,
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

  const module = await moduleService.updateModule(id, result.data);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "module.update",
    targetType: "module",
    targetId: module.id,
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

  await moduleService.deleteModule(id);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "module.delete",
    targetType: "module",
    targetId: id,
  });
  res.status(204).send();
}
