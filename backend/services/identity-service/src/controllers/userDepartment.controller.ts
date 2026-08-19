import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { bigIntId } from "../interfaces/common";
import * as departmentService from "../services/department.service";
import * as outboxService from "../services/outbox.service";
import * as userDepartmentService from "../services/userDepartment.service";
import * as userService from "../services/user.service";
import { parseBigIntId, parsePagination } from "../utils";

const assignDepartmentSchema = z.object({
  departmentId: bigIntId,
  isPrimary: z.boolean().optional().default(false),
});

export async function getDepartmentsForUser(req: Request, res: Response) {
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

  const result = await userDepartmentService.getDepartmentsForUser(userId, pagination);
  res.json(result);
}

export async function assignDepartmentToUser(req: Request, res: Response) {
  const userId = parseBigIntId(req.params.id);
  if (userId === null) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const result = assignDepartmentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const user = await userService.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const department = await departmentService.getDepartmentById(result.data.departmentId);
  if (!department) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await userDepartmentService.assignDepartmentToUser(
      userId,
      department.id,
      result.data.isPrimary,
      tx,
    );
    await outboxService.writeOutboxEvent(tx, {
      eventType: "USER_DEPARTMENT_ASSIGNED",
      aggregateType: "USER",
      aggregateId: userId.toString(),
      actorId: req.auth!.userId.toString(),
      action: "ASSIGN",
      resourceType: "USER",
      resourceId: userId.toString(),
      metadata: { departmentId: department.id.toString() },
    });
    return created;
  });
  res.status(201).json(assignment);
}

export async function revokeDepartmentFromUser(req: Request, res: Response) {
  const userId = parseBigIntId(req.params.id);
  const departmentId = parseBigIntId(req.params.departmentId);
  if (userId === null || departmentId === null) {
    res.status(400).json({ error: "Invalid user or department id" });
    return;
  }

  const revoked = await prisma.$transaction(async (tx) => {
    const wasRevoked = await userDepartmentService.revokeDepartmentFromUser(userId, departmentId, tx);
    if (wasRevoked) {
      await outboxService.writeOutboxEvent(tx, {
        eventType: "USER_DEPARTMENT_REVOKED",
        aggregateType: "USER",
        aggregateId: userId.toString(),
        actorId: req.auth!.userId.toString(),
        action: "REVOKE",
        resourceType: "USER",
        resourceId: userId.toString(),
        metadata: { departmentId: departmentId.toString() },
      });
    }
    return wasRevoked;
  });
  if (!revoked) {
    res.status(404).json({ error: "Department assignment not found" });
    return;
  }
  res.status(204).send();
}
