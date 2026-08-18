import { prisma } from "../config/prisma";
import * as auditLogService from "../services/auditLog.service";

jest.mock("../config/prisma", () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
};

describe("auditLog.service", () => {
  it("recordAuditLog writes the actor, action, and target", async () => {
    mockedPrisma.auditLog.create.mockResolvedValue({ id: 1n });

    await auditLogService.recordAuditLog({
      actorUserId: 9n,
      action: "role.delete",
      targetType: "role",
      targetId: 2n,
    });

    expect(mockedPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 9n,
          action: "role.delete",
          targetType: "role",
          targetId: 2n,
        }),
      }),
    );
  });

  it("getAuditLogs paginates and orders newest first", async () => {
    mockedPrisma.auditLog.findMany.mockResolvedValue([]);
    mockedPrisma.auditLog.count.mockResolvedValue(0);

    await auditLogService.getAuditLogs({ page: 1, pageSize: 20 });

    expect(mockedPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, skip: 0, take: 20 }),
    );
    expect(mockedPrisma.auditLog.count).toHaveBeenCalledWith();
  });
});
