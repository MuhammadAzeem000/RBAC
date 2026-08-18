import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { STATUSES } from "../constants/incidents";
import {
  CreateIncidentInput,
  IncidentResponse,
  ListIncidentsQuery,
  UpdateIncidentInput,
} from "../interfaces/incident";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const STATUS_RANK: Record<string, number> = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

const incidentSelect = {
  id: true,
  externalId: true,
  title: true,
  description: true,
  category: true,
  severity: true,
  priority: true,
  status: true,
  tags: true,
  source: true,
  ownerUserId: true,
  detectedAt: true,
  dueAt: true,
  resolvedAt: true,
  closedAt: true,
  closureCode: true,
  resolutionSummary: true,
  rootCause: true,
  createdBy: true,
  updatedBy: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createIncident(input: CreateIncidentInput, actorUserId: bigint): Promise<IncidentResponse> {
  return prisma.incident.create({
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      priority: input.priority,
      tags: input.tags,
      source: input.source,
      externalId: input.externalId,
      detectedAt: input.detectedAt,
      dueAt: input.dueAt,
      ownerUserId: input.ownerUserId,
      status: "new",
      createdBy: actorUserId,
    },
    select: incidentSelect,
  });
}

export async function listIncidents(query: ListIncidentsQuery): Promise<PaginatedResult<IncidentResponse>> {
  const where: Prisma.IncidentWhereInput = {
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.severity && { severity: query.severity }),
    ...(query.ownerUserId !== undefined && { ownerUserId: query.ownerUserId }),
    ...(query.category && { category: query.category }),
    ...(query.source && { source: query.source }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { externalId: { contains: query.search, mode: "insensitive" } },
      ],
    }),
  };
  const { skip, take } = toSkipTake(query.page, query.pageSize);

  const [data, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      select: incidentSelect,
      orderBy: { [query.sortBy]: query.sortDir },
      skip,
      take,
    }),
    prisma.incident.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, query.page, query.pageSize) };
}

export function getIncidentById(id: bigint): Promise<IncidentResponse | null> {
  return prisma.incident.findFirst({ where: { id, deletedAt: null }, select: incidentSelect });
}

// Used by every sub-resource controller (tasks, evidence, comments, alerts,
// playbook runs) before creating a child row, so attaching something to a
// nonexistent incident 404s instead of surfacing as a raw FK-violation 409.
export async function assertIncidentExists(id: bigint): Promise<void> {
  const exists = await prisma.incident.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!exists) {
    throw new HttpError(404, "Incident not found");
  }
}

export interface IncidentChange {
  type: "status_changed" | "severity_changed" | "assigned" | "updated" | "reopened";
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateIncidentResult {
  incident: IncidentResponse;
  changes: IncidentChange[];
}

/**
 * Applies the lifecycle state machine (New -> Triage -> Investigating ->
 * Containment -> Remediation -> Resolved -> Closed) plus classification
 * edits in one PATCH, matching the REST contract's single update endpoint.
 * Backward status moves are rejected except the explicit reopen path
 * (Closed -> Investigating with `reopen: true`), and Closed incidents
 * reject all other edits until reopened — mirrors the spec's "Prevent
 * normal edits after Closed except reopen" requirement.
 */
export async function updateIncident(
  id: bigint,
  input: UpdateIncidentInput,
  actorUserId: bigint,
): Promise<UpdateIncidentResult> {
  const current = await prisma.incident.findFirst({ where: { id, deletedAt: null } });
  if (!current) {
    throw new HttpError(404, "Incident not found");
  }

  if (input.version !== undefined && input.version !== current.version) {
    throw new HttpError(409, "Incident was modified by someone else — reload and try again");
  }

  const isReopening = current.status === "closed" && input.status === "investigating" && input.reopen === true;

  if (current.status === "closed" && !isReopening) {
    throw new HttpError(400, "Incident is closed — reopen it before making changes");
  }

  const changes: IncidentChange[] = [];
  const data: Prisma.IncidentUpdateInput = { updatedBy: actorUserId, version: { increment: 1 } };

  if (input.status !== undefined && input.status !== current.status) {
    if (!isReopening && STATUS_RANK[input.status] < STATUS_RANK[current.status]) {
      throw new HttpError(400, `Cannot move status backward from "${current.status}" to "${input.status}"`);
    }

    if (input.status === "closed") {
      const closureCode = input.closureCode ?? current.closureCode;
      const resolutionSummary = input.resolutionSummary ?? current.resolutionSummary;
      if (!closureCode || !resolutionSummary) {
        throw new HttpError(400, "Closing an incident requires closureCode and resolutionSummary");
      }
      data.closedAt = new Date();
    }
    if (input.status === "resolved" && !current.resolvedAt) {
      data.resolvedAt = new Date();
    }

    if (isReopening) {
      data.resolvedAt = null;
      data.closedAt = null;
      data.closureCode = null;
      data.resolutionSummary = null;
      changes.push({
        type: "reopened",
        summary: "Incident reopened",
        metadata: { previousClosureCode: current.closureCode },
      });
    } else {
      changes.push({
        type: "status_changed",
        summary: `Status changed from "${current.status}" to "${input.status}"`,
        metadata: { from: current.status, to: input.status },
      });
    }
    data.status = input.status;
  }

  if (input.severity !== undefined && input.severity !== current.severity) {
    changes.push({
      type: "severity_changed",
      summary: `Severity changed from "${current.severity}" to "${input.severity}"`,
      metadata: { from: current.severity, to: input.severity },
    });
    data.severity = input.severity;
  }

  if (input.ownerUserId !== undefined && input.ownerUserId !== current.ownerUserId) {
    changes.push({
      type: "assigned",
      summary: input.ownerUserId ? `Incident assigned to user ${input.ownerUserId}` : "Incident unassigned",
      metadata: { from: current.ownerUserId?.toString() ?? null, to: input.ownerUserId?.toString() ?? null },
    });
    data.ownerUserId = input.ownerUserId;
  }

  const changedGenericFields: string[] = [];
  if (input.title !== undefined) {
    data.title = input.title;
    changedGenericFields.push("title");
  }
  if (input.description !== undefined) {
    data.description = input.description;
    changedGenericFields.push("description");
  }
  if (input.category !== undefined) {
    data.category = input.category;
    changedGenericFields.push("category");
  }
  if (input.priority !== undefined) {
    data.priority = input.priority;
    changedGenericFields.push("priority");
  }
  if (input.tags !== undefined) {
    data.tags = input.tags;
    changedGenericFields.push("tags");
  }
  if (input.dueAt !== undefined) {
    data.dueAt = input.dueAt;
    changedGenericFields.push("dueAt");
  }
  if (!isReopening) {
    if (input.closureCode !== undefined) {
      data.closureCode = input.closureCode;
      changedGenericFields.push("closureCode");
    }
    if (input.resolutionSummary !== undefined) {
      data.resolutionSummary = input.resolutionSummary;
      changedGenericFields.push("resolutionSummary");
    }
    if (input.rootCause !== undefined) {
      data.rootCause = input.rootCause;
      changedGenericFields.push("rootCause");
    }
  }

  if (changedGenericFields.length > 0) {
    changes.push({
      type: "updated",
      summary: `Updated ${changedGenericFields.join(", ")}`,
      metadata: { fields: changedGenericFields },
    });
  }

  const incident = await prisma.incident.update({ where: { id }, data, select: incidentSelect });
  return { incident, changes };
}

// Not part of the spec's core lifecycle (incidents are normally Closed, not
// deleted) — added for administrative cleanup of erroneously-created
// incidents, matching every other resource in this platform having a
// soft-delete endpoint under the same "Delete" permission.
export async function deleteIncident(id: bigint): Promise<void> {
  await assertIncidentExists(id);
  await prisma.incident.update({ where: { id }, data: { deletedAt: new Date() } });
}
