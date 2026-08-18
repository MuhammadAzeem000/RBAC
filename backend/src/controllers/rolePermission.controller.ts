import { Request, Response } from "express";
import { z } from "zod";
import { bigIntId } from "../interfaces/common";
import * as auditLogService from "../services/auditLog.service";
import * as permissionService from "../services/permission.service";
import * as roleService from "../services/role.service";
import * as rolePermissionService from "../services/rolePermission.service";
import { parseBigIntId, parsePagination } from "../utils";

const assignPermissionSchema = z.object({ permissionId: bigIntId });

export async function getPermissionsForRole(req: Request, res: Response) {
  const roleId = parseBigIntId(req.params.id);
  if (roleId === null) {
    res.status(400).json({ error: "Invalid role id" });
    return;
  }

  const pagination = parsePagination(req, res);
  if (!pagination) return;

  const role = await roleService.getRoleById(roleId);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const result = await rolePermissionService.getPermissionsForRole(roleId, pagination);
  res.json(result);
}

export async function assignPermissionToRole(req: Request, res: Response) {
  const roleId = parseBigIntId(req.params.id);
  if (roleId === null) {
    res.status(400).json({ error: "Invalid role id" });
    return;
  }

  const result = assignPermissionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const role = await roleService.getRoleById(roleId);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const permission = await permissionService.getPermissionById(result.data.permissionId);
  if (!permission) {
    res.status(404).json({ error: "Permission not found" });
    return;
  }

  const assignment = await rolePermissionService.assignPermissionToRole(roleId, permission.id);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "role.permission.assign",
    targetType: "role",
    targetId: roleId,
    metadata: { permissionId: permission.id.toString() },
  });
  res.status(201).json(assignment);
}

export async function revokePermissionFromRole(req: Request, res: Response) {
  const roleId = parseBigIntId(req.params.id);
  const permissionId = parseBigIntId(req.params.permissionId);
  if (roleId === null || permissionId === null) {
    res.status(400).json({ error: "Invalid role or permission id" });
    return;
  }

  const revoked = await rolePermissionService.revokePermissionFromRole(roleId, permissionId);
  if (!revoked) {
    res.status(404).json({ error: "Permission assignment not found" });
    return;
  }
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "role.permission.revoke",
    targetType: "role",
    targetId: roleId,
    metadata: { permissionId: permissionId.toString() },
  });
  res.status(204).send();
}
