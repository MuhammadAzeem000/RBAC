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

export async function getDepartments(
  db: Prisma.TransactionClient,
  params: { page: number; pageSize: number; search?: string; isActive?: boolean },
): Promise<PaginatedResult<DepartmentResponse>> {
  const where: Prisma.DepartmentWhereInput = {
    deletedAt: null,
    ...(params.isActive !== undefined && { isActive: params.isActive }),
    ...(params.search && {
      OR: [{ name: { contains: params.search, mode: "insensitive" } }],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    db.department.findMany({ where, select: departmentSelect, orderBy: { sortOrder: "asc" }, skip, take }),
    db.department.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getDepartmentById(db: Prisma.TransactionClient, id: bigint): Promise<DepartmentResponse | null> {
  return db.department.findFirst({ where: { id, deletedAt: null }, select: departmentSelect });
}

export function createDepartment(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  input: CreateDepartmentInput,
): Promise<DepartmentResponse> {
  return db.department.create({ data: { ...input, tenantId }, select: departmentSelect });
}

export function updateDepartment(
  db: Prisma.TransactionClient,
  id: bigint,
  input: UpdateDepartmentInput,
): Promise<DepartmentResponse> {
  return db.department.update({ where: { id }, data: input, select: departmentSelect });
}

export async function departmentHasUserAssignments(db: Prisma.TransactionClient, id: bigint): Promise<boolean> {
  const count = await db.userDepartment.count({ where: { departmentId: id, user: { deletedAt: null } } });
  return count > 0;
}

export function deleteDepartment(db: Prisma.TransactionClient, id: bigint): Promise<DepartmentResponse> {
  return db.department.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: departmentSelect,
  });
}
