import { Request, Response } from "express";
import { z } from "zod";
import { createDepartmentSchema, departmentListQuerySchema, updateDepartmentSchema } from "../interfaces/department";
import * as departmentService from "../services/department.service";
import * as outboxService from "../services/outbox.service";
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

  const result = await departmentService.getDepartments(req.db, query);
  res.json(result);
}

export async function getDepartmentById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const department = await departmentService.getDepartmentById(req.db, id);
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

  const department = await req.db.$transaction(async (tx) => {
    const created = await departmentService.createDepartment(tx, req.auth!.tenantId, result.data);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "DEPARTMENT_CREATED",
      aggregateType: "DEPARTMENT",
      aggregateId: created.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "CREATE",
      resourceType: "DEPARTMENT",
      resourceId: created.id.toString(),
      payload: { name: created.name },
    });
    return created;
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
    (await userDepartmentService.isDepartmentAssignedToUser(req.db, req.auth!.userId, id))
  ) {
    res.status(409).json({ error: "You can't change the active status of a department you belong to" });
    return;
  }

  const department = await req.db.$transaction(async (tx) => {
    const updated = await departmentService.updateDepartment(tx, id, result.data);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "DEPARTMENT_UPDATED",
      aggregateType: "DEPARTMENT",
      aggregateId: updated.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "DEPARTMENT",
      resourceId: updated.id.toString(),
      payload: { name: updated.name },
    });
    return updated;
  });
  res.json(department);
}

export async function deleteDepartment(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (await userDepartmentService.isDepartmentAssignedToUser(req.db, req.auth!.userId, id)) {
    res.status(409).json({ error: "You can't delete a department you belong to" });
    return;
  }

  if (await departmentService.departmentHasUserAssignments(req.db, id)) {
    res.status(409).json({
      error: "This department still has users assigned to it. Remove those assignments before deleting the department.",
    });
    return;
  }

  await req.db.$transaction(async (tx) => {
    await departmentService.deleteDepartment(tx, id);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "DEPARTMENT_DELETED",
      aggregateType: "DEPARTMENT",
      aggregateId: id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "DELETE",
      resourceType: "DEPARTMENT",
      resourceId: id.toString(),
    });
  });
  res.status(204).send();
}
