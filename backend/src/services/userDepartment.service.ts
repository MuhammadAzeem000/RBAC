import { prisma } from "../config/prisma";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const departmentSelect = {
  id: true,
  name: true,
} as const;

export async function getDepartmentsForUser(
  userId: bigint,
  params: { page: number; pageSize: number },
): Promise<PaginatedResult<{ id: bigint; name: string; isPrimary: boolean; assignedAt: Date }>> {
  const where = { userId };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [rows, total] = await Promise.all([
    prisma.userDepartment.findMany({
      where,
      include: { department: { select: departmentSelect } },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    prisma.userDepartment.count({ where }),
  ]);

  const data = rows.map((row) => ({ ...row.department, isPrimary: row.isPrimary, assignedAt: row.createdAt }));
  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function assignDepartmentToUser(userId: bigint, departmentId: bigint, isPrimary: boolean) {
  return prisma.userDepartment.create({
    data: { userId, departmentId, isPrimary },
    include: { department: { select: departmentSelect } },
  });
}

export async function revokeDepartmentFromUser(userId: bigint, departmentId: bigint): Promise<boolean> {
  const { count } = await prisma.userDepartment.deleteMany({ where: { userId, departmentId } });
  return count > 0;
}

export async function isDepartmentAssignedToUser(userId: bigint, departmentId: bigint): Promise<boolean> {
  const assignment = await prisma.userDepartment.findFirst({
    where: { userId, departmentId },
    select: { userId: true },
  });
  return assignment !== null;
}
