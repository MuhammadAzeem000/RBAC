import { Request, Response } from "express";
import { z } from "zod";
import { createRoleSchema, roleListQuerySchema, updateRoleSchema } from "../interfaces/role";
import * as auditLogService from "../services/auditLog.service";
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

  const role = await roleService.createRole(result.data);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "role.create",
    targetType: "role",
    targetId: role.id,
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

  if (result.data.isActive !== undefined && (await userRoleService.isRoleAssignedToUser(req.auth!.userId, id))) {
    res.status(409).json({ error: "You can't change the active status of a role assigned to your own account" });
    return;
  }

  const role = await roleService.updateRole(id, result.data);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "role.update",
    targetType: "role",
    targetId: role.id,
  });
  res.json(role);
}

export async function deleteRole(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (await userRoleService.isRoleAssignedToUser(req.auth!.userId, id)) {
    res.status(409).json({ error: "You can't delete a role assigned to your own account" });
    return;
  }

  if (await roleService.roleHasUserAssignments(id)) {
    res.status(409).json({ error: "This role is still assigned to one or more users. Remove those assignments before deleting the role." });
    return;
  }

  await roleService.deleteRole(id);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "role.delete",
    targetType: "role",
    targetId: id,
  });
  res.status(204).send();
}
