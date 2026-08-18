import "../utils/bigint";
import { Request, Response } from "express";
import * as moduleController from "../controllers/module.controller";
import { prisma } from "../config/prisma";
import * as moduleService from "../services/module.service";

jest.mock("../config/prisma", () => ({
  prisma: {
    module: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    permission: {
      count: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  module: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  permission: {
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

describe("module.service", () => {
  it("getModules filters out soft-deleted modules and paginates", async () => {
    mockedPrisma.module.findMany.mockResolvedValue([]);
    mockedPrisma.module.count.mockResolvedValue(0);

    await moduleService.getModules({ page: 1, pageSize: 20 });

    expect(mockedPrisma.module.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null }, skip: 0, take: 20 }),
    );
  });

  it("getModules computes skip from the page number", async () => {
    mockedPrisma.module.findMany.mockResolvedValue([]);
    mockedPrisma.module.count.mockResolvedValue(45);

    const result = await moduleService.getModules({ page: 3, pageSize: 20 });

    expect(mockedPrisma.module.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.pagination.totalPages).toBe(3);
  });

  it("deleteModule soft-deletes instead of removing the row", async () => {
    mockedPrisma.module.update.mockResolvedValue({ id: 1n });
    await moduleService.deleteModule(1n);
    expect(mockedPrisma.module.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("module.controller", () => {
  it("createModule responds 400 when name is missing", async () => {
    const req = { body: {} } as unknown as Request;
    const res = mockRes();

    await moduleController.createModule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedPrisma.module.create).not.toHaveBeenCalled();
  });

  it("getModuleById responds 404 when the service finds nothing", async () => {
    mockedPrisma.module.findFirst.mockResolvedValue(null);
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await moduleController.getModuleById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deleteModule responds 409 when the module still has permissions", async () => {
    mockedPrisma.permission.count.mockResolvedValue(1);
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await moduleController.deleteModule(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.module.update).not.toHaveBeenCalled();
  });

  it("deleteModule proceeds when the module has no permissions", async () => {
    mockedPrisma.permission.count.mockResolvedValue(0);
    mockedPrisma.module.update.mockResolvedValue({ id: 1n });
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await moduleController.deleteModule(req, res);

    expect(mockedPrisma.module.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1n } }));
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
