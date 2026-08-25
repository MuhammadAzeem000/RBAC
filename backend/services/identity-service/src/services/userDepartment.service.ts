import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const departmentSelect = {
  id: true,
  name: true,
} as const;

export async function getDepartmentsForUser(
  db: Prisma.TransactionClient,
  userId: bigint,
  params: { page: number; pageSize: number },
): Promise<PaginatedResult<{ id: bigint; name: string; isPrimary: boolean; assignedAt: Date }>> {
  const where = { userId };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [rows, total] = await Promise.all([
    db.userDepartment.findMany({
      where,
      include: { department: { select: departmentSelect } },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    db.userDepartment.count({ where }),
  ]);

  const data = rows.map((row) => ({ ...row.department, isPrimary: row.isPrimary, assignedAt: row.createdAt }));
  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function assignDepartmentToUser(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  userId: bigint,
  departmentId: bigint,
  isPrimary: boolean,
) {
  return db.userDepartment.create({
    data: { userId, departmentId, isPrimary, tenantId },
    include: { department: { select: departmentSelect } },
  });
}

export async function revokeDepartmentFromUser(
  db: Prisma.TransactionClient,
  userId: bigint,
  departmentId: bigint,
): Promise<boolean> {
  const { count } = await db.userDepartment.deleteMany({ where: { userId, departmentId } });
  return count > 0;
}

export async function isDepartmentAssignedToUser(
  db: Prisma.TransactionClient,
  userId: bigint,
  departmentId: bigint,
): Promise<boolean> {
  const assignment = await db.userDepartment.findFirst({
    where: { userId, departmentId },
    select: { userId: true },
  });
  return assignment !== null;
}
