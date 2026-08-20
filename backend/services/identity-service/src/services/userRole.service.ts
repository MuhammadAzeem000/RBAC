import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const roleSelect = {
  id: true,
  name: true,
} as const;

export async function getRolesForUser(
  userId: bigint,
  params: { page: number; pageSize: number },
): Promise<PaginatedResult<{ id: bigint; name: string; assignedAt: Date }>> {
  const where = { userId };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [rows, total] = await Promise.all([
    prisma.userRole.findMany({
      where,
      include: { role: { select: roleSelect } },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    prisma.userRole.count({ where }),
  ]);

  const data = rows.map((row) => ({ ...row.role, assignedAt: row.createdAt }));
  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function assignRoleToUser(userId: bigint, roleId: bigint, tx: Prisma.TransactionClient = prisma) {
  return tx.userRole.create({
    data: { userId, roleId },
    include: { role: { select: roleSelect } },
  });
}

export async function revokeRoleFromUser(
  userId: bigint,
  roleId: bigint,
  tx: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  const { count } = await tx.userRole.deleteMany({ where: { userId, roleId } });
  return count > 0;
}

export async function isRoleAssignedToUser(userId: bigint, roleId: bigint): Promise<boolean> {
  const assignment = await prisma.userRole.findFirst({ where: { userId, roleId }, select: { userId: true } });
  return assignment !== null;
}
