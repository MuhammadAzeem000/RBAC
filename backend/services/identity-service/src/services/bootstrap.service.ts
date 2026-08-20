import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { UserResponse } from "../interfaces/user";
import { writeOutboxEvent } from "./outbox.service";

const SALT_ROUNDS = 10;

const MODULES = [
  { name: MODULE_NAMES.DASHBOARD, sortOrder: 0 },
  { name: MODULE_NAMES.USERS, sortOrder: 1 },
  { name: MODULE_NAMES.DEPARTMENTS, sortOrder: 2 },
  { name: MODULE_NAMES.ROLES, sortOrder: 3 },
  { name: MODULE_NAMES.MODULES, sortOrder: 4 },
  { name: MODULE_NAMES.ACTIONS, sortOrder: 5 },
  { name: MODULE_NAMES.PERMISSIONS, sortOrder: 6 },
  { name: MODULE_NAMES.AUDIT_LOGS, sortOrder: 7 },
  { name: MODULE_NAMES.INCIDENTS, sortOrder: 8 },
] as const;

const ACTIONS = [
  { name: ACTION_NAMES.VIEW, sortOrder: 0 },
  { name: ACTION_NAMES.CREATE, sortOrder: 1 },
  { name: ACTION_NAMES.UPDATE, sortOrder: 2 },
  { name: ACTION_NAMES.DELETE, sortOrder: 3 },
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

    // find-or-create, not a bare create: ensureModuleSeeded() (see
    // moduleSeed.service.ts) also runs unconditionally on every server boot
    // to backfill newly-added modules for already-bootstrapped systems, and
    // on a brand-new database it can race ahead of a concurrent first
    // registration — a bare create() here would then hit a unique
    // constraint on [moduleId, actionId] and roll back the whole
    // transaction, which register() reports as the misleading "already
    // initialized" error.
    const permissions = await Promise.all(
      modules.flatMap((module) =>
        actions.map(async (action) => {
          const existing = await tx.permission.findFirst({
            where: { moduleId: module.id, actionId: action.id, deletedAt: null },
          });
          return (
            existing ??
            tx.permission.create({
              data: {
                moduleId: module.id,
                actionId: action.id,
                name: `${action.name} ${module.name}`,
              },
            })
          );
        }),
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

    // Bootstrap registration is a genuine account-state-changing/security
    // event (spec: "authentication/security events") — in the same
    // transaction as everything above, so a rollback of the bootstrap (e.g.
    // the race-check above losing to a concurrent call) also rolls this back.
    await writeOutboxEvent(tx, {
      eventType: "USER_REGISTERED",
      aggregateType: "USER",
      aggregateId: user.id.toString(),
      actorId: user.id.toString(),
      action: "REGISTER",
      resourceType: "USER",
      resourceId: user.id.toString(),
      payload: { name: user.name, email: user.email },
    });

    return user;
  });
}
