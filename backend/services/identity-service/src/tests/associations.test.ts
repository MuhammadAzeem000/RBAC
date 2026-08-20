import "../utils/bigint";
import { Request, Response } from "express";
import * as userRoleController from "../controllers/userRole.controller";
import * as rolePermissionController from "../controllers/rolePermission.controller";
import * as userService from "../services/user.service";
import * as roleService from "../services/role.service";
import * as permissionService from "../services/permission.service";
import * as userRoleService from "../services/userRole.service";
import * as rolePermissionService from "../services/rolePermission.service";

jest.mock("../services/user.service");
jest.mock("../services/role.service");
jest.mock("../services/permission.service");
jest.mock("../services/userRole.service");
jest.mock("../services/rolePermission.service");
jest.mock("../services/outbox.service");
jest.mock("../config/prisma", () => ({
  // Controllers wrap the (fully-mocked) service calls in
  // prisma.$transaction(...) — the callback just needs to run with some
  // stand-in "tx" object, since the mocked service functions ignore it.
  prisma: { $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({})) },
}));

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("userRole associations", () => {
  it("responds 404 when the user does not exist", async () => {
    (userService.getUserById as jest.Mock).mockResolvedValue(null);

    const req = { params: { id: "1" }, body: { roleId: "2" } } as unknown as Request;
    const res = mockRes();

    await userRoleController.assignRoleToUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(userRoleService.assignRoleToUser).not.toHaveBeenCalled();
  });

  it("assigns a role to a user", async () => {
    (userService.getUserById as jest.Mock).mockResolvedValue({ id: 1n });
    (roleService.getRoleById as jest.Mock).mockResolvedValue({ id: 2n });
    (userRoleService.assignRoleToUser as jest.Mock).mockResolvedValue({ userId: 1n, roleId: 2n });

    const req = {
      params: { id: "1" },
      body: { roleId: "2" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await userRoleController.assignRoleToUser(req, res);

    expect(userRoleService.assignRoleToUser).toHaveBeenCalledWith(1n, 2n, expect.anything());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("responds 404 when revoking an assignment that does not exist", async () => {
    (userRoleService.revokeRoleFromUser as jest.Mock).mockResolvedValue(false);

    const req = { params: { id: "1", roleId: "2" } } as unknown as Request;
    const res = mockRes();

    await userRoleController.revokeRoleFromUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("paginates the list of roles assigned to a user", async () => {
    (userService.getUserById as jest.Mock).mockResolvedValue({ id: 1n });
    (userRoleService.getRolesForUser as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    const req = { params: { id: "1" }, query: {} } as unknown as Request;
    const res = mockRes();

    await userRoleController.getRolesForUser(req, res);

    expect(userRoleService.getRolesForUser).toHaveBeenCalledWith(1n, { page: 1, pageSize: 20 });
  });

  it("rejects an invalid pageSize before checking the user exists", async () => {
    const req = { params: { id: "1" }, query: { pageSize: "1000" } } as unknown as Request;
    const res = mockRes();

    await userRoleController.getRolesForUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(userService.getUserById).not.toHaveBeenCalled();
  });
});

describe("rolePermission associations", () => {
  it("responds 404 when the role does not exist", async () => {
    (roleService.getRoleById as jest.Mock).mockResolvedValue(null);

    const req = { params: { id: "1" }, body: { permissionId: "2" } } as unknown as Request;
    const res = mockRes();

    await rolePermissionController.assignPermissionToRole(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(rolePermissionService.assignPermissionToRole).not.toHaveBeenCalled();
  });

  it("assigns a permission to a role", async () => {
    (roleService.getRoleById as jest.Mock).mockResolvedValue({ id: 1n });
    (permissionService.getPermissionById as jest.Mock).mockResolvedValue({ id: 2n });
    (rolePermissionService.assignPermissionToRole as jest.Mock).mockResolvedValue({
      roleId: 1n,
      permissionId: 2n,
    });

    const req = {
      params: { id: "1" },
      body: { permissionId: "2" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await rolePermissionController.assignPermissionToRole(req, res);

    expect(rolePermissionService.assignPermissionToRole).toHaveBeenCalledWith(1n, 2n, expect.anything());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("paginates the list of permissions assigned to a role", async () => {
    (roleService.getRoleById as jest.Mock).mockResolvedValue({ id: 1n });
    (rolePermissionService.getPermissionsForRole as jest.Mock).mockResolvedValue({
      data: [],
      pagination: { page: 2, pageSize: 10, total: 15, totalPages: 2 },
    });

    const req = { params: { id: "1" }, query: { page: "2", pageSize: "10" } } as unknown as Request;
    const res = mockRes();

    await rolePermissionController.getPermissionsForRole(req, res);

    expect(rolePermissionService.getPermissionsForRole).toHaveBeenCalledWith(1n, { page: 2, pageSize: 10 });
  });
});
