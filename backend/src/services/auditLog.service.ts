import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

export interface RecordAuditLogInput {
  actorUserId: bigint;
  action: string;
  targetType: string;
  targetId?: bigint;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: bigint;
  actorUserId: bigint;
  action: string;
  targetType: string;
  targetId: bigint | null;
  metadata: unknown;
  createdAt: Date;
}

const auditLogSelect = {
  id: true,
  actorUserId: true,
  action: true,
  targetType: true,
  targetId: true,
  metadata: true,
  createdAt: true,
} as const;

export function recordAuditLog(input: RecordAuditLogInput): Promise<AuditLogEntry> {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    select: auditLogSelect,
  });
}

export async function getAuditLogs(params: {
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<AuditLogEntry>> {
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({ select: auditLogSelect, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.auditLog.count(),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}
