import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { CreatePermissionInput, PermissionResponse, UpdatePermissionInput } from "../interfaces/permission";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const permissionSelect = {
  id: true,
  moduleId: true,
  actionId: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getPermissions(params: {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
  moduleId?: bigint;
  actionId?: bigint;
}): Promise<PaginatedResult<PermissionResponse>> {
  const where: Prisma.PermissionWhereInput = {
    deletedAt: null,
    ...(params.isActive !== undefined && { isActive: params.isActive }),
    ...(params.moduleId !== undefined && { moduleId: params.moduleId }),
    ...(params.actionId !== undefined && { actionId: params.actionId }),
    ...(params.search && {
      OR: [{ name: { contains: params.search, mode: "insensitive" } }],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.permission.findMany({ where, select: permissionSelect, orderBy: { id: "asc" }, skip, take }),
    prisma.permission.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getPermissionById(id: bigint): Promise<PermissionResponse | null> {
  return prisma.permission.findFirst({ where: { id, deletedAt: null }, select: permissionSelect });
}

export function createPermission(
  input: CreatePermissionInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<PermissionResponse> {
  return tx.permission.create({ data: input, select: permissionSelect });
}

export function updatePermission(
  id: bigint,
  input: UpdatePermissionInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<PermissionResponse> {
  return tx.permission.update({ where: { id }, data: input, select: permissionSelect });
}

export async function permissionHasRoleAssignments(id: bigint): Promise<boolean> {
  const count = await prisma.rolePermission.count({ where: { permissionId: id, role: { deletedAt: null } } });
  return count > 0;
}

export function deletePermission(id: bigint, tx: Prisma.TransactionClient = prisma): Promise<PermissionResponse> {
  return tx.permission.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: permissionSelect,
  });
}
