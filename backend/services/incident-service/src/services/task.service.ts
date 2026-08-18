import { prisma } from "../config/prisma";
import { CreateTaskInput, UpdateTaskInput } from "../interfaces/task";

export interface TaskResponse {
  id: bigint;
  incidentId: bigint;
  title: string;
  description: string | null;
  assigneeUserId: bigint | null;
  dueDate: Date | null;
  status: string;
  completedAt: Date | null;
  completedBy: bigint | null;
  createdBy: bigint;
  createdAt: Date;
  updatedAt: Date | null;
}

const taskSelect = {
  id: true,
  incidentId: true,
  title: true,
  description: true,
  assigneeUserId: true,
  dueDate: true,
  status: true,
  completedAt: true,
  completedBy: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createTask(incidentId: bigint, input: CreateTaskInput, actorUserId: bigint): Promise<TaskResponse> {
  return prisma.task.create({
    data: {
      incidentId,
      title: input.title,
      description: input.description,
      assigneeUserId: input.assigneeUserId,
      dueDate: input.dueDate,
      createdBy: actorUserId,
    },
    select: taskSelect,
  });
}

export function listTasks(incidentId: bigint): Promise<TaskResponse[]> {
  return prisma.task.findMany({ where: { incidentId }, select: taskSelect, orderBy: { createdAt: "asc" } });
}

export function getTaskById(incidentId: bigint, taskId: bigint): Promise<TaskResponse | null> {
  return prisma.task.findFirst({ where: { id: taskId, incidentId }, select: taskSelect });
}

export function updateTask(
  incidentId: bigint,
  taskId: bigint,
  input: UpdateTaskInput,
  actorUserId: bigint,
): Promise<TaskResponse> {
  const completing = input.status === "completed";
  return prisma.task.update({
    where: { id: taskId, incidentId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.assigneeUserId !== undefined && { assigneeUserId: input.assigneeUserId }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.status !== undefined && { status: input.status }),
      ...(completing && { completedAt: new Date(), completedBy: actorUserId }),
    },
    select: taskSelect,
  });
}
