import "../utils/bigint";
import { prisma } from "../config/prisma";
import * as ingestionService from "../services/ingestion.service";
import { HttpError } from "../middlewares/errorHandler";

jest.mock("../config/prisma", () => {
  const resources = {
    alert: { findFirst: jest.fn(), create: jest.fn(), findFirstOrThrow: jest.fn() },
    entity: { createMany: jest.fn() },
  };
  // ingestAlert wraps the business write + outbox insert in
  // db.$transaction(async (tx) => ...) — running the callback against these
  // SAME mocked resources lets tx.alert.create(...) etc. resolve to the same
  // jest.fn() the tests assert against. Mirrors incident-service's own
  // incident.service.test.ts mocking pattern.
  return {
    prisma: {
      ...resources,
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(resources)),
    },
  };
});

jest.mock("../services/outbox.service");

const mockedPrisma = prisma as unknown as {
  alert: { findFirst: jest.Mock; create: jest.Mock; findFirstOrThrow: jest.Mock };
  entity: { createMany: jest.Mock };
};

const baseInput = {
  source: "test-siem",
  externalId: "evt-1",
  severity: "high" as const,
  timestamp: "2026-08-27T00:00:00Z",
  entities: [],
  rawRef: null,
};

function mockFetchOnce(ok: boolean) {
  global.fetch = jest.fn().mockResolvedValue({ ok }) as unknown as typeof fetch;
}

describe("ingestion.service ingestAlert", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the existing alert deduped when (source, externalId) already exists", async () => {
    const existing = { id: 1n, status: "linked" };
    mockedPrisma.alert.findFirst.mockResolvedValue(existing);

    const result = await ingestionService.ingestAlert(prisma as never, 1n, "token", baseInput, 42n);

    expect(result).toEqual({ alert: existing, mode: "deduped" });
    expect(mockedPrisma.alert.create).not.toHaveBeenCalled();
  });

  it("creates with status pending_case when no incidentId is given", async () => {
    mockedPrisma.alert.findFirst.mockResolvedValue(null);
    mockedPrisma.alert.create.mockResolvedValue({ id: 5n });
    mockedPrisma.alert.findFirstOrThrow.mockResolvedValue({ id: 5n, status: "pending_case" });

    const result = await ingestionService.ingestAlert(prisma as never, 1n, "token", baseInput, 42n);

    expect(mockedPrisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "pending_case", tenantId: 1n }) }),
    );
    expect(result.mode).toBe("pending");
  });

  it("attaches synchronously (status attached) when incidentId is given and the incident exists", async () => {
    mockedPrisma.alert.findFirst.mockResolvedValue(null);
    mockedPrisma.alert.create.mockResolvedValue({ id: 6n });
    mockedPrisma.alert.findFirstOrThrow.mockResolvedValue({ id: 6n, status: "attached", incidentId: 7n });
    mockFetchOnce(true);

    const result = await ingestionService.ingestAlert(prisma as never, 1n, "token", { ...baseInput, incidentId: "7" }, 42n);

    expect(mockedPrisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "attached", incidentId: 7n }) }),
    );
    expect(result.mode).toBe("attached");
  });

  it("throws 404 when attaching to an incident that doesn't exist", async () => {
    mockedPrisma.alert.findFirst.mockResolvedValue(null);
    mockFetchOnce(false);

    await expect(
      ingestionService.ingestAlert(prisma as never, 1n, "token", { ...baseInput, incidentId: "999" }, 42n),
    ).rejects.toThrow(HttpError);
    expect(mockedPrisma.alert.create).not.toHaveBeenCalled();
  });
});
