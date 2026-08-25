import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { createPermissionSchema, permissionListQuerySchema, updatePermissionSchema } from "../interfaces/permission";
import * as outboxService from "../services/outbox.service";
import * as permissionService from "../services/permission.service";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid permission id" });
    return null;
  }
  return id;
}

export async function getPermissions(req: Request, res: Response) {
  const query = parseQuery(permissionListQuerySchema, req, res);
  if (!query) return;

  const result = await permissionService.getPermissions(query);
  res.json(result);
}

export async function getPermissionById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const permission = await permissionService.getPermissionById(id);
  if (!permission) {
    res.status(404).json({ error: "Permission not found" });
    return;
  }
  res.json(permission);
}

export async function createPermission(req: Request, res: Response) {
  const result = createPermissionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const permission = await prisma.$transaction(async (tx) => {
    const created = await permissionService.createPermission(result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "PERMISSION_CREATED",
      aggregateType: "PERMISSION",
      aggregateId: created.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "CREATE",
      resourceType: "PERMISSION",
      resourceId: created.id.toString(),
      payload: { name: created.name },
    });
    return created;
  });
  res.status(201).json(permission);
}

export async function updatePermission(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updatePermissionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const permission = await prisma.$transaction(async (tx) => {
    const updated = await permissionService.updatePermission(id, result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "PERMISSION_UPDATED",
      aggregateType: "PERMISSION",
      aggregateId: updated.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "PERMISSION",
      resourceId: updated.id.toString(),
      payload: { name: updated.name },
    });
    return updated;
  });
  res.json(permission);
}

export async function deletePermission(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (await permissionService.permissionHasRoleAssignments(id)) {
    res.status(409).json({
      error: "This permission is still assigned to one or more roles. Remove those assignments before deleting the permission.",
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await permissionService.deletePermission(id, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "PERMISSION_DELETED",
      aggregateType: "PERMISSION",
      aggregateId: id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "DELETE",
      resourceType: "PERMISSION",
      resourceId: id.toString(),
    });
  });
  res.status(204).send();
}
