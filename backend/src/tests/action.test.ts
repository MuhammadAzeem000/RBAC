import "../utils/bigint";
import { Request, Response } from "express";
import * as actionController from "../controllers/action.controller";
import { prisma } from "../config/prisma";
import * as actionService from "../services/action.service";

jest.mock("../config/prisma", () => ({
  prisma: {
    action: {
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
  action: {
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

describe("action.service", () => {
  it("getActions filters out soft-deleted actions and paginates", async () => {
    mockedPrisma.action.findMany.mockResolvedValue([]);
    mockedPrisma.action.count.mockResolvedValue(0);

    await actionService.getActions({ page: 1, pageSize: 20 });

    expect(mockedPrisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null }, skip: 0, take: 20 }),
    );
  });

  it("getActions computes skip from the page number", async () => {
    mockedPrisma.action.findMany.mockResolvedValue([]);
    mockedPrisma.action.count.mockResolvedValue(45);

    const result = await actionService.getActions({ page: 3, pageSize: 20 });

    expect(mockedPrisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.pagination.totalPages).toBe(3);
  });

  it("deleteAction soft-deletes instead of removing the row", async () => {
    mockedPrisma.action.update.mockResolvedValue({ id: 1n });
    await actionService.deleteAction(1n);
    expect(mockedPrisma.action.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("action.controller", () => {
  it("createAction responds 400 when name is missing", async () => {
    const req = { body: {} } as unknown as Request;
    const res = mockRes();

    await actionController.createAction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedPrisma.action.create).not.toHaveBeenCalled();
  });

  it("getActionById responds 404 when the service finds nothing", async () => {
    mockedPrisma.action.findFirst.mockResolvedValue(null);
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await actionController.getActionById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deleteAction responds 409 when the action still has permissions", async () => {
    mockedPrisma.permission.count.mockResolvedValue(1);
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await actionController.deleteAction(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockedPrisma.action.update).not.toHaveBeenCalled();
  });

  it("deleteAction proceeds when the action has no permissions", async () => {
    mockedPrisma.permission.count.mockResolvedValue(0);
    mockedPrisma.action.update.mockResolvedValue({ id: 1n });
    const req = { params: { id: "1" } } as unknown as Request;
    const res = mockRes();

    await actionController.deleteAction(req, res);

    expect(mockedPrisma.action.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1n } }));
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
