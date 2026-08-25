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
  tenantSlug: string;
  tenantName: string;
}

/**
 * Provisions a tenant's first admin: creates the Tenant if its slug doesn't
 * exist yet, seeds the module/action/permission taxonomy (idempotent, shared
 * across every tenant), finds-or-creates the single global "Administrator"
 * role, and creates the caller as that tenant's first User holding it.
 *
 * Runs once PER TENANT, not once globally — re-checked here (tenant-scoped,
 * not a system-wide user count) as a race backstop against two concurrent
 * first-registrations for the same new tenant.
 *
 * The Administrator role is intentionally NOT granted the Tenants module
 * (see MODULE_NAMES.TENANTS) — that would let any tenant's own admin manage
 * every OTHER tenant. Platform-level access is granted explicitly, the same
 * way any other permission is: through the Roles/Permissions UI.
 */
export async function bootstrapFirstAdmin(input: BootstrapFirstAdminInput): Promise<UserResponse> {
  return prisma.$transaction(async (tx) => {
    const tenant =
      (await tx.tenant.findFirst({ where: { slug: input.tenantSlug } })) ??
      (await tx.tenant.create({ data: { slug: input.tenantSlug, name: input.tenantName } }));

    const existingUserCount = await tx.user.count({ where: { tenantId: tenant.id } });
    if (existingUserCount > 0) {
      throw new Error("Tenant already initialized");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

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
    // to backfill newly-added modules, and could race ahead of a concurrent
    // first registration for another tenant — a bare create() here would
    // then hit a unique constraint on [moduleId, actionId] and roll back.
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

    // Global, shared across every tenant — find-or-create, not a bare
    // create, since this now runs once per tenant rather than once ever.
    const role =
      (await tx.role.findFirst({ where: { name: "Administrator", deletedAt: null } })) ??
      (await tx.role.create({
        data: { name: "Administrator", description: "Full access to every module and action.", isSystem: true },
      }));

    for (const permission of permissions) {
      const alreadyGranted = await tx.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!alreadyGranted) {
        await tx.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      }
    }

    const user = await tx.user.create({
      data: { tenantId: tenant.id, name: input.name, email: input.email, passwordHash },
      select: {
        id: true,
        tenantId: true,
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

    await tx.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } });

    // Bootstrap registration is a genuine account-state-changing/security
    // event (spec: "authentication/security events") — in the same
    // transaction as everything above, so a rollback of the bootstrap (e.g.
    // the race-check above losing to a concurrent call) also rolls this back.
    await writeOutboxEvent(tx, {
      tenantId: tenant.id,
      eventType: "USER_REGISTERED",
      aggregateType: "USER",
      aggregateId: user.id.toString(),
      actorId: user.id.toString(),
      action: "REGISTER",
      resourceType: "USER",
      resourceId: user.id.toString(),
      payload: { name: user.name, email: user.email, tenantId: tenant.id.toString() },
    });

    return user;
  });
}
