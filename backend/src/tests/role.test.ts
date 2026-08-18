import "../utils/bigint";
import { Request, Response } from "express";
import * as roleController from "../controllers/role.controller";
import { prisma } from "../config/prisma";
import * as roleService from "../services/role.service";

jest.mock("../config/prisma", () => ({
  prisma: {
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userRole: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  role: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  userRole: {
    findFirst: jest.Mock;
    count: jest.Mock;
  };
};

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("role.service", () => {
  it("getRoles computes skip from the page number", async () => {
    mockedPrisma.role.findMany.mockResolvedValue([]);
    mockedPrisma.role.count.mockResolvedValue(45);

    const result = await roleService.getRoles({ page: 3, pageSize: 20 });

    expect(mockedPrisma.role.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    expect(result.pagination.totalPages).toBe(3);
  });

  it("deleteRole soft-deletes instead of removing the row", async () => {
    mockedPrisma.role.update.mockResolvedValue({ id: 1n });
    await roleService.deleteRole(1n);
    expect(mockedPrisma.role.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("role.controller", () => {
  it("createRole responds 400 when name is missing", async () => {
    const req = { body: {} } as unknown as Request;
    const res = mockRes();

    await roleController.createRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedPrisma.role.create).not.toHaveBeenCalled();
  });

  it("createRole creates the role", async () => {
    mockedPrisma.role.create.mockResolvedValue({ id: 1n });
    const req = {
      body: { name: "Auditor" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await roleController.createRole(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("getRoleById responds 404 when the service finds nothing", async () => {
    mockedPrisma.role.findFirst.mockResolvedValue(null);
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await roleController.getRoleById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updateRole responds 409 when changing the active status of a role assigned to your own account", async () => {
    mockedPrisma.userRole.findFirst.mockResolvedValue({ userId: 9n });
    const req = {
      params: { id: "1" },
      body: { isActive: false },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await roleController.updateRole(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.role.update).not.toHaveBeenCalled();
  });

  it("updateRole proceeds when changing the active status of a role not assigned to your own account", async () => {
    mockedPrisma.userRole.findFirst.mockResolvedValue(null);
    mockedPrisma.role.update.mockResolvedValue({ id: 1n });
    const req = {
      params: { id: "1" },
      body: { isActive: false },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await roleController.updateRole(req, res);

    expect(mockedPrisma.role.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1n } }));
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteRole responds 409 when the role is assigned to your own account", async () => {
    mockedPrisma.userRole.findFirst.mockResolvedValue({ userId: 9n });
    const req = {
      params: { id: "1" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await roleController.deleteRole(req, res);

    expect(mockedPrisma.userRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 9n, roleId: 1n } }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.role.update).not.toHaveBeenCalled();
  });

  it("deleteRole responds 409 when the role is still assigned to other users", async () => {
    mockedPrisma.userRole.findFirst.mockResolvedValue(null);
    mockedPrisma.userRole.count.mockResolvedValue(1);
    const req = {
      params: { id: "1" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await roleController.deleteRole(req, res);

    expect(mockedPrisma.userRole.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roleId: 1n, user: { deletedAt: null } } }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.role.update).not.toHaveBeenCalled();
  });

  it("deleteRole proceeds when the role isn't assigned to anyone", async () => {
    mockedPrisma.userRole.findFirst.mockResolvedValue(null);
    mockedPrisma.userRole.count.mockResolvedValue(0);
    mockedPrisma.role.update.mockResolvedValue({ id: 1n });
    const req = {
      params: { id: "1" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await roleController.deleteRole(req, res);

    expect(mockedPrisma.role.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1n } }));
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
