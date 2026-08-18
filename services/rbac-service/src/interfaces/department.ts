import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const departmentListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  status: z.string().trim().max(30).optional(),
  isActive: z.boolean().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export interface DepartmentResponse {
  id: bigint;
  name: string;
  description: string | null;
  status: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date | null;
}
