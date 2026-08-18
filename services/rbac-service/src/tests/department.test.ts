import "../utils/bigint";
import { Request, Response } from "express";
import * as departmentController from "../controllers/department.controller";
import { prisma } from "../config/prisma";
import * as departmentService from "../services/department.service";

jest.mock("../config/prisma", () => ({
  prisma: {
    department: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userDepartment: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("../services/auditLog.service");

const mockedPrisma = prisma as unknown as {
  department: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  userDepartment: {
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

describe("department.service", () => {
  it("getDepartments computes skip from the page number", async () => {
    mockedPrisma.department.findMany.mockResolvedValue([]);
    mockedPrisma.department.count.mockResolvedValue(45);

    const result = await departmentService.getDepartments({ page: 3, pageSize: 20 });

    expect(mockedPrisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.pagination.totalPages).toBe(3);
  });

  it("deleteDepartment soft-deletes instead of removing the row", async () => {
    mockedPrisma.department.update.mockResolvedValue({ id: 1n });
    await departmentService.deleteDepartment(1n);
    expect(mockedPrisma.department.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("department.controller", () => {
  it("createDepartment responds 400 when name is missing", async () => {
    const req = { body: {} } as unknown as Request;
    const res = mockRes();

    await departmentController.createDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedPrisma.department.create).not.toHaveBeenCalled();
  });

  it("createDepartment creates the department", async () => {
    mockedPrisma.department.create.mockResolvedValue({ id: 1n });
    const req = {
      body: { name: "Infrastructure" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await departmentController.createDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("getDepartmentById responds 404 when the service finds nothing", async () => {
    mockedPrisma.department.findFirst.mockResolvedValue(null);
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await departmentController.getDepartmentById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updateDepartment responds 409 when changing the active status of a department you belong to", async () => {
    mockedPrisma.userDepartment.findFirst.mockResolvedValue({ userId: 9n });
    const req = {
      params: { id: "1" },
      body: { isActive: false },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await departmentController.updateDepartment(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.department.update).not.toHaveBeenCalled();
  });

  it("updateDepartment proceeds when changing the active status of a department you don't belong to", async () => {
    mockedPrisma.userDepartment.findFirst.mockResolvedValue(null);
    mockedPrisma.department.update.mockResolvedValue({ id: 1n });
    const req = {
      params: { id: "1" },
      body: { isActive: false },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await departmentController.updateDepartment(req, res);

    expect(mockedPrisma.department.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1n } }));
    expect(res.json).toHaveBeenCalled();
  });

  it("deleteDepartment responds 409 when you belong to the department", async () => {
    mockedPrisma.userDepartment.findFirst.mockResolvedValue({ userId: 9n });
    const req = {
      params: { id: "1" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await departmentController.deleteDepartment(req, res);

    expect(mockedPrisma.userDepartment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 9n, departmentId: 1n } }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.department.update).not.toHaveBeenCalled();
  });

  it("deleteDepartment responds 409 when other users are assigned to the department", async () => {
    mockedPrisma.userDepartment.findFirst.mockResolvedValue(null);
    mockedPrisma.userDepartment.count.mockResolvedValue(1);
    const req = {
      params: { id: "1" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await departmentController.deleteDepartment(req, res);

    expect(mockedPrisma.userDepartment.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { departmentId: 1n, user: { deletedAt: null } } }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.department.update).not.toHaveBeenCalled();
  });

  it("deleteDepartment proceeds when no one is assigned to the department", async () => {
    mockedPrisma.userDepartment.findFirst.mockResolvedValue(null);
    mockedPrisma.userDepartment.count.mockResolvedValue(0);
    mockedPrisma.department.update.mockResolvedValue({ id: 1n });
    const req = {
      params: { id: "1" },
      auth: { userId: 9n, email: "alice@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await departmentController.deleteDepartment(req, res);

    expect(mockedPrisma.department.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1n } }),
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
