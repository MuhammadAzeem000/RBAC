import "../utils/bigint";
import { prisma } from "../config/prisma";
import * as incidentService from "../services/incident.service";
import { HttpError } from "../middlewares/errorHandler";

jest.mock("../config/prisma", () => {
  const resources = {
    incident: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  // createIncident/updateIncident/deleteIncident wrap the business write +
  // outbox insert in prisma.$transaction(async (tx) => ...) — running the
  // callback against these SAME mocked resources lets tx.incident.update(...)
  // etc. resolve to the same jest.fn() the tests assert against.
  return { prisma: { ...resources, $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(resources)) } };
});

jest.mock("../services/outbox.service");

const mockedPrisma = prisma as unknown as {
  incident: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
};

function baseIncident(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    status: "investigating",
    severity: "medium",
    ownerUserId: null,
    version: 1,
    closureCode: null,
    resolutionSummary: null,
    resolvedAt: null,
    closedAt: null,
    ...overrides,
  };
}

describe("incident.service createIncident", () => {
  it("creates with status 'new' and the caller as creator", async () => {
    mockedPrisma.incident.create.mockResolvedValue({ id: 1n, status: "new" });

    await incidentService.createIncident(prisma as never, 1n, { title: "Suspicious login", severity: "high" }, 42n);

    expect(mockedPrisma.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Suspicious login", severity: "high", status: "new", createdBy: 42n }),
      }),
    );
  });
});

describe("incident.service updateIncident", () => {
  it("throws 404 when the incident doesn't exist", async () => {
    mockedPrisma.incident.findFirst.mockResolvedValue(null);

    await expect(incidentService.updateIncident(prisma as never, 1n, 1n, {}, 1n)).rejects.toMatchObject({ status: 404 });
  });

  it("throws 409 on optimistic concurrency mismatch", async () => {
    mockedPrisma.incident.findFirst.mockResolvedValue(baseIncident({ version: 3 }));

    await expect(incidentService.updateIncident(prisma as never, 1n, 1n, { version: 2 }, 1n)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("rejects any edit on a closed incident that isn't an explicit reopen", async () => {
    mockedPrisma.incident.findFirst.mockResolvedValue(baseIncident({ status: "closed" }));

    await expect(incidentService.updateIncident(prisma as never, 1n, 1n, { title: "New title" }, 1n)).rejects.toThrow(
      HttpError,
    );
  });

  it("rejects moving status backward", async () => {
    mockedPrisma.incident.findFirst.mockResolvedValue(baseIncident({ status: "containment" }));

    await expect(incidentService.updateIncident(prisma as never, 1n, 1n, { status: "triage" }, 1n)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("requires closureCode and resolutionSummary to close", async () => {
    mockedPrisma.incident.findFirst.mockResolvedValue(baseIncident({ status: "resolved" }));

    await expect(incidentService.updateIncident(prisma as never, 1n, 1n, { status: "closed" }, 1n)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("allows a valid forward transition and records a status_changed change", async () => {
    mockedPrisma.incident.findFirst.mockResolvedValue(baseIncident({ status: "triage" }));
    mockedPrisma.incident.update.mockResolvedValue(baseIncident({ status: "investigating" }));

    const result = await incidentService.updateIncident(prisma as never, 1n, 1n, { status: "investigating" }, 1n);

    expect(result.changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "status_changed" })]),
    );
  });

  it("allows reopening a closed incident and clears its closure fields", async () => {
    mockedPrisma.incident.findFirst.mockResolvedValue(
      baseIncident({ status: "closed", closureCode: "false_positive", resolvedAt: new Date(), closedAt: new Date() }),
    );
    mockedPrisma.incident.update.mockResolvedValue(baseIncident({ status: "investigating" }));

    const result = await incidentService.updateIncident(
      prisma as never,
      1n,
      1n,
      { status: "investigating", reopen: true },
      1n,
    );

    expect(mockedPrisma.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolvedAt: null, closedAt: null, closureCode: null, resolutionSummary: null }),
      }),
    );
    expect(result.changes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "reopened" })]));
  });
});
