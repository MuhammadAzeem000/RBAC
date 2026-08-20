import { prisma } from "../config/prisma";

// Pure RBAC check: does any active role assigned to this user grant
// actionName on moduleName, via an active, non-deleted permission?
export async function userHasPermission(
  userId: bigint,
  moduleName: string,
  actionName: string,
): Promise<boolean> {
  const match = await prisma.rolePermission.findFirst({
    where: {
      role: { isActive: true, deletedAt: null, userRoles: { some: { userId } } },
      permission: {
        isActive: true,
        deletedAt: null,
        module: { name: moduleName },
        action: { name: actionName },
      },
    },
    select: { roleId: true },
  });
  return match !== null;
}

// For each module reachable through any of the user's active roles' active
// permissions, the distinct action names granted on it — drives both nav/menu
// visibility and per-action (create/edit/delete) control gating on the frontend.
export async function getMyPermissions(userId: bigint): Promise<{ name: string; actions: string[] }[]> {
  const roleFilter = { isActive: true, deletedAt: null, userRoles: { some: { userId } } } as const;

  const modules = await prisma.module.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      permissions: {
        some: { isActive: true, deletedAt: null, rolePermissions: { some: { role: roleFilter } } },
      },
    },
    select: {
      name: true,
      permissions: {
        where: { isActive: true, deletedAt: null, rolePermissions: { some: { role: roleFilter } } },
        select: { action: { select: { name: true } } },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return modules.map((module) => ({
    name: module.name,
    actions: [...new Set(module.permissions.map((permission) => permission.action.name))],
  }));
}
