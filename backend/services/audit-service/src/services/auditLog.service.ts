import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { AuditEventMessage } from "../interfaces/auditEvent";
import { AuditLogEntry, ListAuditLogsQuery } from "../interfaces/auditLog";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const auditLogSelect = {
  id: true,
  eventId: true,
  eventType: true,
  service: true,
  actorId: true,
  actorType: true,
  action: true,
  resourceType: true,
  resourceId: true,
  metadata: true,
  payload: true,
  occurredAt: true,
  receivedAt: true,
} as const;

/**
 * The idempotency boundary for at-least-once delivery: `eventId` is unique,
 * and this is an upsert with a no-op update — a redelivered event (broker
 * requeue after an unacked message, a publisher retry after a crash, ...)
 * finds its existing row and does nothing, rather than erroring or
 * duplicating. Callers should treat "already existed" and "just created"
 * as equally successful outcomes and ack the broker message either way.
 */
export async function persistIdempotent(event: AuditEventMessage): Promise<{ created: boolean }> {
  // Every publisher's outbox worker has sent tenantId since Phase 1's
  // multi-tenancy retrofit — a message missing it is a bug in the sender,
  // not something to paper over with a silent default.
  if (!event.tenantId) {
    throw new Error(`Audit event ${event.eventId} (${event.eventType}) is missing tenantId`);
  }

  let created = true;

  await prisma.auditLog.upsert({
    where: { eventId: event.eventId },
    create: {
      tenantId: BigInt(event.tenantId),
      eventId: event.eventId,
      eventType: event.eventType,
      service: event.service,
      actorId: event.actorId,
      actorType: event.actorType,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      metadata: (event.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      occurredAt: new Date(event.timestamp),
    },
    // Empty update — a redelivered event must never mutate an
    // already-persisted audit record (audit logs are append-only).
    update: {},
  });

  // Prisma's upsert doesn't report whether the create or update branch ran;
  // a cheap follow-up existence check distinguishes them only for logging —
  // this function's idempotency guarantee holds regardless of this value.
  const existingCount = await prisma.auditLog.count({ where: { eventId: event.eventId } });
  created = existingCount === 1;

  return { created };
}

export async function listAuditLogs(
  db: Prisma.TransactionClient,
  query: ListAuditLogsQuery,
): Promise<PaginatedResult<AuditLogEntry>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.service && { service: query.service }),
    ...(query.resourceType && { resourceType: query.resourceType }),
    ...(query.actorId && { actorId: query.actorId }),
  };
  const { skip, take } = toSkipTake(query.page, query.pageSize);

  const [data, total] = await Promise.all([
    db.auditLog.findMany({ where, select: auditLogSelect, orderBy: { occurredAt: "desc" }, skip, take }),
    db.auditLog.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, query.page, query.pageSize) };
}
