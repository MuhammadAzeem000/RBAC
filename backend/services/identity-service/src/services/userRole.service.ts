import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const roleSelect = {
  id: true,
  name: true,
} as const;

export async function getRolesForUser(
  db: Prisma.TransactionClient,
  userId: bigint,
  params: { page: number; pageSize: number },
): Promise<PaginatedResult<{ id: bigint; name: string; assignedAt: Date }>> {
  const where = { userId };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [rows, total] = await Promise.all([
    db.userRole.findMany({
      where,
      include: { role: { select: roleSelect } },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    db.userRole.count({ where }),
  ]);

  const data = rows.map((row) => ({ ...row.role, assignedAt: row.createdAt }));
  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function assignRoleToUser(db: Prisma.TransactionClient, tenantId: bigint, userId: bigint, roleId: bigint) {
  return db.userRole.create({
    data: { userId, roleId, tenantId },
    include: { role: { select: roleSelect } },
  });
}

export async function revokeRoleFromUser(
  db: Prisma.TransactionClient,
  userId: bigint,
  roleId: bigint,
): Promise<boolean> {
  const { count } = await db.userRole.deleteMany({ where: { userId, roleId } });
  return count > 0;
}

export async function isRoleAssignedToUser(
  db: Prisma.TransactionClient,
  userId: bigint,
  roleId: bigint,
): Promise<boolean> {
  const assignment = await db.userRole.findFirst({ where: { userId, roleId }, select: { userId: true } });
  return assignment !== null;
}
