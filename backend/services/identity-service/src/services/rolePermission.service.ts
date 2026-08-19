import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const permissionSelect = {
  id: true,
  name: true,
  moduleId: true,
  actionId: true,
} as const;

export async function getPermissionsForRole(
  roleId: bigint,
  params: { page: number; pageSize: number },
): Promise<
  PaginatedResult<{
    id: bigint;
    name: string;
    moduleId: bigint;
    actionId: bigint;
    assignedAt: Date;
  }>
> {
  const where = { roleId };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [rows, total] = await Promise.all([
    prisma.rolePermission.findMany({
      where,
      include: { permission: { select: permissionSelect } },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    prisma.rolePermission.count({ where }),
  ]);

  const data = rows.map((row) => ({ ...row.permission, assignedAt: row.createdAt }));
  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function assignPermissionToRole(roleId: bigint, permissionId: bigint, tx: Prisma.TransactionClient = prisma) {
  return tx.rolePermission.create({
    data: { roleId, permissionId },
    include: { permission: { select: permissionSelect } },
  });
}

export async function revokePermissionFromRole(
  roleId: bigint,
  permissionId: bigint,
  tx: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  const { count } = await tx.rolePermission.deleteMany({ where: { roleId, permissionId } });
  return count > 0;
}
