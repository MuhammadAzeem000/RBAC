import { Request, Response } from "express";
import { z } from "zod";
import { createTaskSchema, updateTaskSchema } from "../interfaces/task";
import * as taskService from "../services/task.service";
import * as incidentService from "../services/incident.service";
import { recordTimelineEvent } from "../services/timeline.service";
import { publishEvent } from "../events/eventBus.service";
import { ROUTING_KEYS } from "../events/topology";
import { parseBigIntId } from "../utils";

function parseIds(req: Request, res: Response): { incidentId: bigint; taskId?: bigint } | null {
  const incidentId = parseBigIntId(req.params.id);
  if (incidentId === null) {
    res.status(400).json({ error: "Invalid incident id" });
    return null;
  }
  if (req.params.taskId === undefined) return { incidentId };

  const taskId = parseBigIntId(req.params.taskId);
  if (taskId === null) {
    res.status(400).json({ error: "Invalid task id" });
    return null;
  }
  return { incidentId, taskId };
}

export async function createTask(req: Request, res: Response) {
  const ids = parseIds(req, res);
  if (!ids) return;

  const result = createTaskSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  await incidentService.assertIncidentExists(ids.incidentId);
  const task = await taskService.createTask(ids.incidentId, result.data, req.auth!.userId);

  await recordTimelineEvent({
    incidentId: ids.incidentId,
    eventType: "task_created",
    actorUserId: req.auth!.userId,
    summary: `Task created: "${task.title}"`,
    metadata: { taskId: task.id.toString() },
  });
  void publishEvent(ROUTING_KEYS.TASK_CREATED, {
    incidentId: ids.incidentId.toString(),
    taskId: task.id.toString(),
  });

  res.status(201).json(task);
}

export async function listTasks(req: Request, res: Response) {
  const ids = parseIds(req, res);
  if (!ids) return;

  await incidentService.assertIncidentExists(ids.incidentId);
  const tasks = await taskService.listTasks(ids.incidentId);
  res.json({ data: tasks });
}

export async function updateTask(req: Request, res: Response) {
  const ids = parseIds(req, res);
  if (!ids || ids.taskId === undefined) {
    if (ids) res.status(400).json({ error: "Task id is required" });
    return;
  }

  const result = updateTaskSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const existing = await taskService.getTaskById(ids.incidentId, ids.taskId);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const task = await taskService.updateTask(ids.incidentId, ids.taskId, result.data, req.auth!.userId);

  const justCompleted = result.data.status === "completed" && existing.status !== "completed";
  await recordTimelineEvent({
    incidentId: ids.incidentId,
    eventType: justCompleted ? "task_completed" : "task_updated",
    actorUserId: req.auth!.userId,
    summary: justCompleted ? `Task completed: "${task.title}"` : `Task updated: "${task.title}"`,
    metadata: { taskId: task.id.toString() },
  });
  if (justCompleted) {
    void publishEvent(ROUTING_KEYS.TASK_COMPLETED, {
      incidentId: ids.incidentId.toString(),
      taskId: task.id.toString(),
    });
  }

  res.json(task);
}
