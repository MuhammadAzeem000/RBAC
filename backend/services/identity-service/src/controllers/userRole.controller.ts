import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { bigIntId } from "../interfaces/common";
import * as outboxService from "../services/outbox.service";
import * as roleService from "../services/role.service";
import * as userRoleService from "../services/userRole.service";
import * as userService from "../services/user.service";
import { parseBigIntId, parsePagination } from "../utils";

const assignRoleSchema = z.object({ roleId: bigIntId });

export async function getRolesForUser(req: Request, res: Response) {
  const userId = parseBigIntId(req.params.id);
  if (userId === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const pagination = parsePagination(req, res);
  if (!pagination) return;

  const user = await userService.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const result = await userRoleService.getRolesForUser(userId, pagination);
  res.json(result);
}

export async function assignRoleToUser(req: Request, res: Response) {
  const userId = parseBigIntId(req.params.id);
  if (userId === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const result = assignRoleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const user = await userService.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const role = await roleService.getRoleById(result.data.roleId);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await userRoleService.assignRoleToUser(userId, role.id, tx);
    await outboxService.writeOutboxEvent(tx, {
      eventType: "USER_ROLE_ASSIGNED",
      aggregateType: "USER",
      aggregateId: userId.toString(),
      actorId: req.auth!.userId.toString(),
      action: "ASSIGN",
      resourceType: "USER",
      resourceId: userId.toString(),
      metadata: { roleId: role.id.toString() },
    });
    return created;
  });
  res.status(201).json(assignment);
}

export async function revokeRoleFromUser(req: Request, res: Response) {
  const userId = parseBigIntId(req.params.id);
  const roleId = parseBigIntId(req.params.roleId);
  if (userId === null || roleId === null) {
    res.status(400).json({ error: "Invalid user or role id" });
    return;
  }

  const revoked = await prisma.$transaction(async (tx) => {
    const wasRevoked = await userRoleService.revokeRoleFromUser(userId, roleId, tx);
    if (wasRevoked) {
      await outboxService.writeOutboxEvent(tx, {
        eventType: "USER_ROLE_REVOKED",
        aggregateType: "USER",
        aggregateId: userId.toString(),
        actorId: req.auth!.userId.toString(),
        action: "REVOKE",
        resourceType: "USER",
        resourceId: userId.toString(),
        metadata: { roleId: roleId.toString() },
      });
    }
    return wasRevoked;
  });
  if (!revoked) {
    res.status(404).json({ error: "Role assignment not found" });
    return;
  }
  res.status(204).send();
}
