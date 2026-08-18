import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";
import { CreateRoleInput, RoleResponse, UpdateRoleInput } from "../interfaces/role";

const roleSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getRoles(params: {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
}): Promise<PaginatedResult<RoleResponse>> {
  const where: Prisma.RoleWhereInput = {
    deletedAt: null,
    ...(params.isActive !== undefined && { isActive: params.isActive }),
    ...(params.search && {
      OR: [{ name: { contains: params.search, mode: "insensitive" } }],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.role.findMany({ where, select: roleSelect, orderBy: { name: "asc" }, skip, take }),
    prisma.role.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getRoleById(id: bigint): Promise<RoleResponse | null> {
  return prisma.role.findFirst({ where: { id, deletedAt: null }, select: roleSelect });
}

export function createRole(input: CreateRoleInput): Promise<RoleResponse> {
  return prisma.role.create({ data: input, select: roleSelect });
}

export function updateRole(id: bigint, input: UpdateRoleInput): Promise<RoleResponse> {
  return prisma.role.update({ where: { id }, data: input, select: roleSelect });
}

export async function roleHasUserAssignments(id: bigint): Promise<boolean> {
  const count = await prisma.userRole.count({ where: { roleId: id, user: { deletedAt: null } } });
  return count > 0;
}

export function deleteRole(id: bigint): Promise<RoleResponse> {
  return prisma.role.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: roleSelect,
  });
}
