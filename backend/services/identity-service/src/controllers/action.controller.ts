import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { actionListQuerySchema, createActionSchema, updateActionSchema } from "../interfaces/action";
import * as actionService from "../services/action.service";
import * as outboxService from "../services/outbox.service";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid action id" });
    return null;
  }
  return id;
}

export async function getActions(req: Request, res: Response) {
  const query = parseQuery(actionListQuerySchema, req, res);
  if (!query) return;

  const result = await actionService.getActions(query);
  res.json(result);
}

export async function getActionById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const action = await actionService.getActionById(id);
  if (!action) {
    res.status(404).json({ error: "Action not found" });
    return;
  }
  res.json(action);
}

export async function createAction(req: Request, res: Response) {
  const result = createActionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const action = await prisma.$transaction(async (tx) => {
    const created = await actionService.createAction(result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "ACTION_CREATED",
      aggregateType: "ACTION",
      aggregateId: created.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "CREATE",
      resourceType: "ACTION",
      resourceId: created.id.toString(),
      payload: { name: created.name },
    });
    return created;
  });
  res.status(201).json(action);
}

export async function updateAction(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updateActionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const action = await prisma.$transaction(async (tx) => {
    const updated = await actionService.updateAction(id, result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "ACTION_UPDATED",
      aggregateType: "ACTION",
      aggregateId: updated.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "ACTION",
      resourceId: updated.id.toString(),
      payload: { name: updated.name },
    });
    return updated;
  });
  res.json(action);
}

export async function deleteAction(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (await actionService.actionHasPermissions(id)) {
    res.status(409).json({
      error: "This action still has permissions defined for it. Remove them before deleting the action.",
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await actionService.deleteAction(id, tx);
    await outboxService.writeOutboxEvent(tx, {
      tenantId: req.auth!.tenantId,
      eventType: "ACTION_DELETED",
      aggregateType: "ACTION",
      aggregateId: id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "DELETE",
      resourceType: "ACTION",
      resourceId: id.toString(),
    });
  });
  res.status(204).send();
}
