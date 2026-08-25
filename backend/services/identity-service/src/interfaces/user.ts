import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const userListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(255),
});

export const updateUserSchema = createUserSchema.partial().extend({
  status: z.string().trim().max(30).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserResponse {
  id: bigint;
  tenantId: bigint;
  name: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}
