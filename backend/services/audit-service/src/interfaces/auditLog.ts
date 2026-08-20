import { z } from "zod";
import { paginationQuerySchema } from "./pagination";

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  service: z.string().trim().max(50).optional(),
  resourceType: z.string().trim().max(50).optional(),
  actorId: z.string().trim().max(100).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export interface AuditLogEntry {
  id: bigint;
  eventId: string;
  eventType: string;
  service: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: unknown;
  payload: unknown;
  occurredAt: Date;
  receivedAt: Date;
}
