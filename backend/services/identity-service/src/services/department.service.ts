import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { CreateDepartmentInput, DepartmentResponse, UpdateDepartmentInput } from "../interfaces/department";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const departmentSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getDepartments(params: {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
}): Promise<PaginatedResult<DepartmentResponse>> {
  const where: Prisma.DepartmentWhereInput = {
    deletedAt: null,
    ...(params.isActive !== undefined && { isActive: params.isActive }),
    ...(params.search && {
      OR: [{ name: { contains: params.search, mode: "insensitive" } }],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.department.findMany({ where, select: departmentSelect, orderBy: { sortOrder: "asc" }, skip, take }),
    prisma.department.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getDepartmentById(id: bigint): Promise<DepartmentResponse | null> {
  return prisma.department.findFirst({ where: { id, deletedAt: null }, select: departmentSelect });
}

export function createDepartment(
  input: CreateDepartmentInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<DepartmentResponse> {
  return tx.department.create({ data: input, select: departmentSelect });
}

export function updateDepartment(
  id: bigint,
  input: UpdateDepartmentInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<DepartmentResponse> {
  return tx.department.update({ where: { id }, data: input, select: departmentSelect });
}

export async function departmentHasUserAssignments(id: bigint): Promise<boolean> {
  const count = await prisma.userDepartment.count({ where: { departmentId: id, user: { deletedAt: null } } });
  return count > 0;
}

export function deleteDepartment(id: bigint, tx: Prisma.TransactionClient = prisma): Promise<DepartmentResponse> {
  return tx.department.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: departmentSelect,
  });
}
