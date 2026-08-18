import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { ActionResponse, CreateActionInput, UpdateActionInput } from "../interfaces/action";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const actionSelect = {
  id: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getActions(params: {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
}): Promise<PaginatedResult<ActionResponse>> {
  const where: Prisma.ActionWhereInput = {
    deletedAt: null,
    ...(params.isActive !== undefined && { isActive: params.isActive }),
    ...(params.search && {
      OR: [{ name: { contains: params.search, mode: "insensitive" } }],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.action.findMany({ where, select: actionSelect, orderBy: { sortOrder: "asc" }, skip, take }),
    prisma.action.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getActionById(id: bigint): Promise<ActionResponse | null> {
  return prisma.action.findFirst({ where: { id, deletedAt: null }, select: actionSelect });
}

export function createAction(input: CreateActionInput): Promise<ActionResponse> {
  return prisma.action.create({ data: input, select: actionSelect });
}

export function updateAction(id: bigint, input: UpdateActionInput): Promise<ActionResponse> {
  return prisma.action.update({ where: { id }, data: input, select: actionSelect });
}

export async function actionHasPermissions(id: bigint): Promise<boolean> {
  const count = await prisma.permission.count({ where: { actionId: id, deletedAt: null } });
  return count > 0;
}

export function deleteAction(id: bigint): Promise<ActionResponse> {
  return prisma.action.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: actionSelect,
  });
}
