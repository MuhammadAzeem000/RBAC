import { z } from "zod";
import { UserResponse } from "./user";

const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase alphanumeric, dash-separated");

// Email is unique per tenant, not globally (two tenants can each have a user
// at the same address), so login has to know which tenant to look in —
// there's no subdomain/host-based tenant routing in this codebase, so it's
// an explicit field instead, same as register.
export const loginSchema = z.object({
  tenantSlug: tenantSlugSchema,
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(255),
  // Identifies which tenant this registration bootstraps. If no tenant with
  // this slug exists yet, it's created (using tenantName, or the slug itself
  // if no name is given); if it already exists and already has an admin,
  // registration is rejected — this endpoint only ever creates a TENANT'S
  // FIRST admin, never an arbitrary account (see bootstrap.service.ts).
  tenantSlug: tenantSlugSchema,
  tenantName: z.string().trim().min(1).max(150).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export interface AccessTokenClaims {
  sub: string;
  email: string;
  tenantId: string;
  type: "access";
}

export interface RefreshTokenClaims {
  sub: string;
  type: "refresh";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: UserResponse;
}
