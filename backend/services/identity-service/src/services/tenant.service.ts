// Tenant itself is the root of the tenancy hierarchy, so unlike every other
// service in this file, these functions deliberately use the raw `prisma`
// singleton — there's no tenantId column on Tenant to scope against.
import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";
import { CreateTenantInput, TenantResponse, UpdateTenantInput } from "../interfaces/tenant";

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getTenants(params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<PaginatedResult<TenantResponse>> {
  const where: Prisma.TenantWhereInput = {
    ...(params.search && {
      OR: [
        { name: { contains: params.search, mode: "insensitive" } },
        { slug: { contains: params.search, mode: "insensitive" } },
      ],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.tenant.findMany({ where, select: tenantSelect, orderBy: { id: "asc" }, skip, take }),
    prisma.tenant.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getTenantById(id: bigint): Promise<TenantResponse | null> {
  return prisma.tenant.findFirst({ where: { id }, select: tenantSelect });
}

export function createTenant(
  input: CreateTenantInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<TenantResponse> {
  return tx.tenant.create({ data: input, select: tenantSelect });
}

export function updateTenant(
  id: bigint,
  input: UpdateTenantInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<TenantResponse> {
  return tx.tenant.update({ where: { id }, data: input, select: tenantSelect });
}
