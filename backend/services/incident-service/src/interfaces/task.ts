import { z } from "zod";
import { TASK_STATUSES } from "../constants/incidents";

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5_000).optional(),
  assigneeUserId: z.coerce.bigint().optional(),
  dueDate: z.coerce.date().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5_000).optional(),
  assigneeUserId: z.coerce.bigint().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
