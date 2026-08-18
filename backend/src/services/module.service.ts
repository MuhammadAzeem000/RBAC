import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { CreateModuleInput, ModuleResponse, UpdateModuleInput } from "../interfaces/module";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";

const moduleSelect = {
  id: true,
  name: true,
  description: true,
  icon: true,
  route: true,
  sortOrder: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getModules(params: {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
}): Promise<PaginatedResult<ModuleResponse>> {
  const where: Prisma.ModuleWhereInput = {
    deletedAt: null,
    ...(params.isActive !== undefined && { isActive: params.isActive }),
    ...(params.search && {
      OR: [{ name: { contains: params.search, mode: "insensitive" } }],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.module.findMany({ where, select: moduleSelect, orderBy: { sortOrder: "asc" }, skip, take }),
    prisma.module.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getModuleById(id: bigint): Promise<ModuleResponse | null> {
  return prisma.module.findFirst({ where: { id, deletedAt: null }, select: moduleSelect });
}

export function createModule(input: CreateModuleInput): Promise<ModuleResponse> {
  return prisma.module.create({ data: input, select: moduleSelect });
}

export function updateModule(id: bigint, input: UpdateModuleInput): Promise<ModuleResponse> {
  return prisma.module.update({ where: { id }, data: input, select: moduleSelect });
}

export async function moduleHasPermissions(id: bigint): Promise<boolean> {
  const count = await prisma.permission.count({ where: { moduleId: id, deletedAt: null } });
  return count > 0;
}

export function deleteModule(id: bigint): Promise<ModuleResponse> {
  return prisma.module.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: moduleSelect,
  });
}
