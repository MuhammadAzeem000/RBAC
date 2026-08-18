import { Request, Response } from "express";
import { z } from "zod";
import { createDepartmentSchema, departmentListQuerySchema, updateDepartmentSchema } from "../interfaces/department";
import * as auditLogService from "../services/auditLog.service";
import * as departmentService from "../services/department.service";
import * as userDepartmentService from "../services/userDepartment.service";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid department id" });
    return null;
  }
  return id;
}

export async function getDepartments(req: Request, res: Response) {
  const query = parseQuery(departmentListQuerySchema, req, res);
  if (!query) return;

  const result = await departmentService.getDepartments(query);
  res.json(result);
}

export async function getDepartmentById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const department = await departmentService.getDepartmentById(id);
  if (!department) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.json(department);
}

export async function createDepartment(req: Request, res: Response) {
  const result = createDepartmentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const department = await departmentService.createDepartment(result.data);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "department.create",
    targetType: "department",
    targetId: department.id,
  });
  res.status(201).json(department);
}

export async function updateDepartment(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updateDepartmentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  if (
    result.data.isActive !== undefined &&
    (await userDepartmentService.isDepartmentAssignedToUser(req.auth!.userId, id))
  ) {
    res.status(409).json({ error: "You can't change the active status of a department you belong to" });
    return;
  }

  const department = await departmentService.updateDepartment(id, result.data);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "department.update",
    targetType: "department",
    targetId: department.id,
  });
  res.json(department);
}

export async function deleteDepartment(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (await userDepartmentService.isDepartmentAssignedToUser(req.auth!.userId, id)) {
    res.status(409).json({ error: "You can't delete a department you belong to" });
    return;
  }

  if (await departmentService.departmentHasUserAssignments(id)) {
    res.status(409).json({
      error: "This department still has users assigned to it. Remove those assignments before deleting the department.",
    });
    return;
  }

  await departmentService.deleteDepartment(id);
  await auditLogService.recordAuditLog({
    actorUserId: req.auth!.userId,
    action: "department.delete",
    targetType: "department",
    targetId: id,
  });
  res.status(204).send();
}
