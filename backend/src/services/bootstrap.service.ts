import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { UserResponse } from "../interfaces/user";

const SALT_ROUNDS = 10;

const MODULES = [
  { name: "Dashboard", sortOrder: 0 },
  { name: "Users", sortOrder: 1 },
  { name: "Departments", sortOrder: 2 },
  { name: "Roles", sortOrder: 3 },
  { name: "Modules", sortOrder: 4 },
  { name: "Actions", sortOrder: 5 },
  { name: "Permissions", sortOrder: 6 },
  { name: "Audit Logs", sortOrder: 7 },
] as const;

const ACTIONS = [
  { name: "View", sortOrder: 0 },
  { name: "Create", sortOrder: 1 },
  { name: "Update", sortOrder: 2 },
  { name: "Delete", sortOrder: 3 },
] as const;

export interface BootstrapFirstAdminInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Seeds the module/action taxonomy, one permission per module x action, an
 * "Administrator" role holding all of them, and the first user assigned to
 * that role. Only ever called once — the caller must ensure no user exists
 * yet before invoking this (re-checked here as a race backstop).
 */
export async function bootstrapFirstAdmin(input: BootstrapFirstAdminInput): Promise<UserResponse> {
  // Cheap check outside the transaction so a normal "already initialized"
  // call fails fast without taking a write transaction at all.
  if ((await prisma.user.count()) > 0) {
    throw new Error("System already initialized");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    // Re-checked inside the transaction to close the race between two
    // concurrent first-registration calls that both passed the check above.
    if ((await tx.user.count()) > 0) {
      throw new Error("System already initialized");
    }

    const modules = await Promise.all(
      MODULES.map(async (moduleSeed) => {
        const existing = await tx.module.findFirst({ where: { name: moduleSeed.name, deletedAt: null } });
        return existing ?? tx.module.create({ data: { ...moduleSeed, isSystem: true } });
      }),
    );
    const actions = await Promise.all(
      ACTIONS.map(async (actionSeed) => {
        const existing = await tx.action.findFirst({ where: { name: actionSeed.name, deletedAt: null } });
        return existing ?? tx.action.create({ data: actionSeed });
      }),
    );

    const permissions = await Promise.all(
      modules.flatMap((module) =>
        actions.map((action) =>
          tx.permission.create({
            data: {
              moduleId: module.id,
              actionId: action.id,
              name: `${action.name} ${module.name}`,
            },
          }),
        ),
      ),
    );

    const role = await tx.role.create({
      data: {
        name: "Administrator",
        description: "Full access to every module and action.",
        isSystem: true,
      },
    });

    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });

    const user = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: {
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
      },
    });

    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });

    return user;
  });
}
