import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { createUserSchema, updateUserSchema, userListQuerySchema } from "../interfaces/user";
import * as outboxService from "../services/outbox.service";
import * as userService from "../services/user.service";
import { publishEvent } from "../events/eventBus.service";
import { USER_CREATED_ROUTING_KEY } from "../events/topology";
import { parseBigIntId, parseQuery } from "../utils";

function parseId(req: Request, res: Response): bigint | null {
  const id = parseBigIntId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid user id" });
    return null;
  }
  return id;
}

export async function getUsers(req: Request, res: Response) {
  const query = parseQuery(userListQuerySchema, req, res);
  if (!query) return;

  const result = await userService.getUsers(query);
  res.json(result);
}

export async function getUserById(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const user = await userService.getUserById(id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
}

export async function createUser(req: Request, res: Response) {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await userService.createUser(result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      eventType: "USER_CREATED",
      aggregateType: "USER",
      aggregateId: created.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "CREATE",
      resourceType: "USER",
      resourceId: created.id.toString(),
      payload: { name: created.name, email: created.email },
    });
    return created;
  });
  // Fire-and-forget: the welcome email is a side effect of user creation,
  // not a precondition for it — publishEvent() never throws, so a broker
  // outage can't turn into a failed create-user request.
  void publishEvent(USER_CREATED_ROUTING_KEY, {
    userId: user.id.toString(),
    name: user.name,
    email: user.email,
  });
  res.status(201).json(user);
}

export async function updateUser(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  if (req.auth!.userId === id && result.data.isActive !== undefined) {
    res.status(409).json({ error: "You can't change your own active status" });
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await userService.updateUser(id, result.data, tx);
    await outboxService.writeOutboxEvent(tx, {
      eventType: "USER_UPDATED",
      aggregateType: "USER",
      aggregateId: updated.id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "UPDATE",
      resourceType: "USER",
      resourceId: updated.id.toString(),
      payload: { name: updated.name, email: updated.email },
    });
    return updated;
  });
  res.json(user);
}

export async function deleteUser(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  if (req.auth!.userId === id) {
    res.status(409).json({ error: "You can't delete your own account" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await userService.deleteUser(id, tx);
    await outboxService.writeOutboxEvent(tx, {
      eventType: "USER_DELETED",
      aggregateType: "USER",
      aggregateId: id.toString(),
      actorId: req.auth!.userId.toString(),
      action: "DELETE",
      resourceType: "USER",
      resourceId: id.toString(),
    });
  });
  res.status(204).send();
}
