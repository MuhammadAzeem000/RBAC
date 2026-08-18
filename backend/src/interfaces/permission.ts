import { z } from "zod";
import { bigIntId } from "./common";
import { paginationQuerySchema } from "./pagination";

export const permissionListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  isActive: z.coerce.boolean().optional(),
  moduleId: bigIntId.optional(),
  actionId: bigIntId.optional(),
});

export type PermissionListQuery = z.infer<typeof permissionListQuerySchema>;

export const createPermissionSchema = z.object({
  moduleId: bigIntId,
  actionId: bigIntId,
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().optional(),
});

export const updatePermissionSchema = createPermissionSchema
  .pick({ name: true, description: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

export interface PermissionResponse {
  id: bigint;
  moduleId: bigint;
  actionId: bigint;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
