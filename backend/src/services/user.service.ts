import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { Prisma } from "../generated/prisma/client";
import { buildPaginationMeta, PaginatedResult, toSkipTake } from "../interfaces/pagination";
import { CreateUserInput, UpdateUserInput, UserResponse } from "../interfaces/user";

const SALT_ROUNDS = 10;

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  status: true,
  isActive: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getUsers(params: {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
}): Promise<PaginatedResult<UserResponse>> {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(params.isActive !== undefined && { isActive: params.isActive }),
    ...(params.search && {
      OR: [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ],
    }),
  };
  const { skip, take } = toSkipTake(params.page, params.pageSize);

  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, select: userSelect, orderBy: { id: "asc" }, skip, take }),
    prisma.user.count({ where }),
  ]);

  return { data, pagination: buildPaginationMeta(total, params.page, params.pageSize) };
}

export function getUserById(id: bigint): Promise<UserResponse | null> {
  return prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
}

export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
    select: userSelect,
  });
}

export async function updateUser(id: bigint, input: UpdateUserInput): Promise<UserResponse> {
  const { password, ...rest } = input;

  return prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(password !== undefined && { passwordHash: await bcrypt.hash(password, SALT_ROUNDS) }),
    },
    select: userSelect,
  });
}

export function deleteUser(id: bigint): Promise<UserResponse> {
  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: userSelect,
  });
}
