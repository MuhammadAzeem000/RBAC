import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const actionListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ActionListQuery = z.infer<typeof actionListQuerySchema>;

export const createActionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateActionSchema = createActionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type UpdateActionInput = z.infer<typeof updateActionSchema>;

export interface ActionResponse {
  id: bigint;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
