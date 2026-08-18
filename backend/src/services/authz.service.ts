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

// Distinct module names reachable through any of the user's active roles'
// active permissions — drives nav/menu visibility on the frontend.
export async function getMyModuleNames(userId: bigint): Promise<string[]> {
  const modules = await prisma.module.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      permissions: {
        some: {
          isActive: true,
          deletedAt: null,
          rolePermissions: {
            some: {
              role: { isActive: true, deletedAt: null, userRoles: { some: { userId } } },
            },
          },
        },
      },
    },
    select: { name: true },
    orderBy: { sortOrder: "asc" },
  });
  return modules.map((module) => module.name);
}
