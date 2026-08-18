import { z } from "zod";
import { SEVERITIES, STATUSES } from "../constants/incidents";
import { paginationQuerySchema } from "./pagination";

export const createIncidentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().max(10_000).optional(),
  category: z.string().trim().max(100).optional(),
  severity: z.enum(SEVERITIES),
  priority: z.string().trim().max(20).optional(),
  tags: z.array(z.string().trim().max(50)).max(20).optional(),
  source: z.string().trim().max(100).optional(),
  externalId: z.string().trim().max(100).optional(),
  detectedAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  ownerUserId: z.coerce.bigint().optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

// PATCH covers both classification edits and lifecycle transitions (status)
// — the spec's REST surface defines one update endpoint, not a separate
// "transition" action, so the service layer validates status transitions
// and closure-field requirements inline.
export const updateIncidentSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10_000).optional(),
  category: z.string().trim().max(100).optional(),
  severity: z.enum(SEVERITIES).optional(),
  priority: z.string().trim().max(20).optional(),
  tags: z.array(z.string().trim().max(50)).max(20).optional(),
  status: z.enum(STATUSES).optional(),
  ownerUserId: z.coerce.bigint().nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  closureCode: z.string().trim().max(50).optional(),
  resolutionSummary: z.string().trim().max(10_000).optional(),
  rootCause: z.string().trim().max(10_000).optional(),
  // Only meaningful when status is being set to "investigating" while the
  // incident is currently "closed" — see incident.service.ts#updateIncident.
  reopen: z.boolean().optional(),
  version: z.coerce.number().int().positive().optional(),
});

export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

export const listIncidentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  ownerUserId: z.coerce.bigint().optional(),
  category: z.string().trim().max(100).optional(),
  source: z.string().trim().max(100).optional(),
  search: z.string().trim().min(1).max(255).optional(),
  sortBy: z.enum(["createdAt", "severity", "updatedAt", "dueAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>;

export interface IncidentResponse {
  id: bigint;
  externalId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  priority: string | null;
  status: string;
  tags: unknown;
  source: string | null;
  ownerUserId: bigint | null;
  detectedAt: Date | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  closureCode: string | null;
  resolutionSummary: string | null;
  rootCause: string | null;
  createdBy: bigint;
  updatedBy: bigint | null;
  version: number;
  createdAt: Date;
  updatedAt: Date | null;
}
