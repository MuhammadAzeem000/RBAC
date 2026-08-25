import { z } from "zod";

// Canonical Tenant shape. identity-service owns the authoritative Tenant
// table (see its prisma/schema.prisma); every other service only ever holds
// a `tenantId` column validated against the JWT claim, never a local copy of
// this full record.
export const tenantStatusSchema = z.enum(["active", "suspended"]);
export type TenantStatus = z.infer<typeof tenantStatusSchema>;

export const tenantSchema = z.object({
  id: z.string(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase alphanumeric, dash-separated"),
  name: z.string().trim().min(1).max(150),
  status: tenantStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export type Tenant = z.infer<typeof tenantSchema>;

export const createTenantSchema = tenantSchema.pick({ slug: true, name: true });
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
