import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { createRoleSchema, roleListQuerySchema, updateRoleSchema } from "../interfaces/role";
import * as outboxService from "../services/outbox.service";
import * as roleService from "../services/role.service";
import * as userRoleService from "../services/userRole.service";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid role id" });
    return null;
  }
  return id;
}

export async function getRoles(req: Request, res: Response) {
  const query = parseQuery(roleListQuerySchema, req, res);
  if (!query) return;

  const result = await roleService.getRoles(query);
  res.json(result);
}

export async function getRoleById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const role = await roleService.getRoleById(id);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  res.json(role);
}

export async function createRole(req: Request, res: Response) {
  const result = createRoleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const role = await prisma.$transaction(async (tx) => {
    const created = await roleService.createRole(result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "ROLE_CREATED",
      aggregateType: "ROLE",
      aggregateId: created.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "CREATE",
      resourceType: "ROLE",
      resourceId: created.id.toString(),
      payload: { name: created.name },
    });
    return created;
  });
  res.status(201).json(role);
}

export async function updateRole(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updateRoleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  // Raw prisma, not req.db: Role isn't tenant-scoped, and this specific
  // lookup is already filtered by req.auth.userId, which alone pins it to
  // exactly one tenant — no unscoped-leak risk.
  if (
    result.data.isActive !== undefined &&
    (await userRoleService.isRoleAssignedToUser(prisma, req.auth!.userId, id))
  ) {
    res.status(409).json({ error: "You can't change the active status of a role assigned to your own account" });
    return;
  }

  const role = await prisma.$transaction(async (tx) => {
    const updated = await roleService.updateRole(id, result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "ROLE_UPDATED",
      aggregateType: "ROLE",
      aggregateId: updated.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "ROLE",
      resourceId: updated.id.toString(),
      payload: { name: updated.name },
    });
    return updated;
  });
  res.json(role);
}

export async function deleteRole(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (await userRoleService.isRoleAssignedToUser(prisma, req.auth!.userId, id)) {
    res.status(409).json({ error: "You can't delete a role assigned to your own account" });
    return;
  }

  if (await roleService.roleHasUserAssignments(id)) {
    res.status(409).json({ error: "This role is still assigned to one or more users. Remove those assignments before deleting the role." });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await roleService.deleteRole(id, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "ROLE_DELETED",
      aggregateType: "ROLE",
      aggregateId: id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "DELETE",
      resourceType: "ROLE",
      resourceId: id.toString(),
    });
  });
  res.status(204).send();
}
