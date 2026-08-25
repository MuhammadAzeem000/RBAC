import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

export interface RecordTimelineEventInput {
  incidentId: bigint;
  eventType: string;
  actorUserId?: bigint | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineEventEntry {
  id: bigint;
  incidentId: bigint;
  eventType: string;
  actorUserId: bigint | null;
  summary: string;
  metadata: unknown;
  createdAt: Date;
}

const timelineSelect = {
  id: true,
  incidentId: true,
  eventType: true,
  actorUserId: true,
  summary: true,
  metadata: true,
  createdAt: true,
} as const;

// Append-only — there is deliberately no update/delete function here. This
// is the incident's audit trail as well as its UX activity feed.
export function recordTimelineEvent(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  input: RecordTimelineEventInput,
): Promise<TimelineEventEntry> {
  return db.timelineEvent.create({
    data: {
      // See incident.service.ts::createIncident for why this is passed
      // explicitly even though the tenant-scoping extension overwrites it.
      tenantId,
      incidentId: input.incidentId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? undefined,
      summary: input.summary,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
    select: timelineSelect,
  });
}

export async function getTimeline(
  db: Prisma.TransactionClient,
  incidentId: bigint,
  params: { page: number; pageSize: number },
): Promise<PaginatedResult<TimelineEventEntry>> {
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    db.timelineEvent.findMany({
      where: { incidentId },
      select: timelineSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    db.timelineEvent.count({ where: { incidentId } }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}
