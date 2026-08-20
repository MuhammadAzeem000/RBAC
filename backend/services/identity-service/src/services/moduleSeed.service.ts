import { prisma } from "../config/prisma";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";

/**
 * Backfills a module (+ its View/Create/Update/Delete permissions) for
 * systems that were already bootstrapped before this module existed —
 * bootstrapFirstAdmin only ever runs once, so a new module added later needs
 * its own idempotent seed path. Grants the new permissions to the
 * "Administrator" system role only; any other existing role must be granted
 * access explicitly through the normal Roles UI, same as any other
 * newly-introduced capability.
 */
export async function ensureModuleSeeded(moduleName: string, sortOrder: number): Promise<void> {
  const module =
    (await prisma.module.findFirst({ where: { name: moduleName, deletedAt: null } })) ??
    (await prisma.module.create({ data: { name: moduleName, sortOrder, isSystem: true } }));

  const actionNames = Object.values(ACTION_NAMES);
  const actions = await Promise.all(
    actionNames.map(async (actionName) => {
      const existing = await prisma.action.findFirst({ where: { name: actionName, deletedAt: null } });
      if (existing) return existing;
      const sameNameIndex = actionNames.indexOf(actionName);
      return prisma.action.create({ data: { name: actionName, sortOrder: sameNameIndex } });
    }),
  );

  const permissions = await Promise.all(
    actions.map(async (action) => {
      const existing = await prisma.permission.findFirst({
        where: { moduleId: module.id, actionId: action.id, deletedAt: null },
      });
      return (
        existing ??
        prisma.permission.create({
          data: { moduleId: module.id, actionId: action.id, name: `${action.name} ${module.name}` },
        })
      );
    }),
  );

  const adminRole = await prisma.role.findFirst({ where: { name: "Administrator", deletedAt: null } });
  if (!adminRole) return;

  for (const permission of permissions) {
    const alreadyGranted = await prisma.rolePermission.findFirst({
      where: { roleId: adminRole.id, permissionId: permission.id },
    });
    if (!alreadyGranted) {
      await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: permission.id } });
    }
  }
}
