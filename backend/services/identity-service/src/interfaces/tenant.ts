import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase alphanumeric, dash-separated");

export const tenantListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
});
export type TenantListQuery = z.infer<typeof tenantListQuerySchema>;

export const createTenantSchema = z.object({
  slug: tenantSlugSchema,
  name: z.string().trim().min(1).max(150),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export interface TenantResponse {
  id: bigint;
  slug: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date | null;
}
