import { prisma } from "../config/prisma";
import * as auditLogService from "../services/auditLog.service";
import { AuditEventMessage } from "../interfaces/auditEvent";

jest.mock("../config/prisma", () => ({
  prisma: {
    auditLog: { upsert: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  auditLog: { upsert: jest.Mock; count: jest.Mock; findMany: jest.Mock };
};

function makeEvent(overrides: Partial<AuditEventMessage> = {}): AuditEventMessage {
  return {
    eventId: "event-123",
    eventType: "INCIDENT_CREATED",
    timestamp: "2026-08-19T00:00:00.000Z",
    service: "incident-service",
    tenantId: "1",
    actorId: "1",
    actorType: "USER",
    action: "CREATE",
    resourceType: "INCIDENT",
    resourceId: "42",
    metadata: {},
    payload: { title: "Suspicious login" },
    ...overrides,
  };
}

describe("auditLog.service persistIdempotent", () => {
  it("creates a new audit log row for a fresh eventId", async () => {
    mockedPrisma.auditLog.upsert.mockResolvedValue({});
    mockedPrisma.auditLog.count.mockResolvedValue(1);

    const result = await auditLogService.persistIdempotent(makeEvent());

    expect(mockedPrisma.auditLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "event-123" },
        create: expect.objectContaining({ tenantId: 1n }),
        update: {},
      }),
    );
    expect(result.created).toBe(true);
  });

  it("throws when the event is missing tenantId, rather than silently defaulting it", async () => {
    await expect(
      auditLogService.persistIdempotent(makeEvent({ tenantId: undefined as unknown as string })),
    ).rejects.toThrow(/tenantId/);
    expect(mockedPrisma.auditLog.upsert).not.toHaveBeenCalled();
  });

  it("is idempotent — processing the same eventId three times only ever upserts with the same conflict key and never throws", async () => {
    mockedPrisma.auditLog.upsert.mockResolvedValue({});
    mockedPrisma.auditLog.count.mockResolvedValue(1);

    const event = makeEvent();
    await auditLogService.persistIdempotent(event);
    await auditLogService.persistIdempotent(event);
    await auditLogService.persistIdempotent(event);

    expect(mockedPrisma.auditLog.upsert).toHaveBeenCalledTimes(3);
    for (const call of mockedPrisma.auditLog.upsert.mock.calls) {
      expect(call[0]).toMatchObject({ where: { eventId: "event-123" }, update: {} });
    }
  });
});
