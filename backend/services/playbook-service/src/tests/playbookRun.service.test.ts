import "../utils/bigint";
import { prisma } from "../config/prisma";
import * as playbookRunService from "../services/playbookRun.service";
import * as playbookCatalogService from "../services/playbookCatalog.service";
import * as temporalClient from "../temporal/client";
import { HttpError } from "../middlewares/errorHandler";

jest.mock("../config/prisma", () => ({
  prisma: { playbookRun: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() } },
}));
jest.mock("../services/playbookCatalog.service");
jest.mock("../temporal/client");

const mockedPrisma = prisma as unknown as {
  playbookRun: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
};
const mockedCatalog = playbookCatalogService as unknown as { findLatestVersionByKey: jest.Mock };
const mockedClient = temporalClient as unknown as {
  startPlaybookRunWorkflow: jest.Mock;
  cancelPlaybookRunWorkflow: jest.Mock;
};

const resolvedVersion = {
  playbookVersionId: 10n,
  playbookKey: "enrich-ioc",
  playbookName: "Enrich Indicators of Compromise",
  version: "1.0",
  requiresApproval: false,
  startPolicyKey: null,
  steps: [],
  edges: [],
};

describe("playbookRun.service startPlaybookRun", () => {
  afterEach(() => jest.restoreAllMocks());

  it("throws 400 for an unknown playbook key", async () => {
    mockedCatalog.findLatestVersionByKey.mockResolvedValue(null);

    await expect(
      playbookRunService.startPlaybookRun(prisma as never, 1n, 2n, { incidentId: "2", playbookKey: "nope" }, 42n),
    ).rejects.toThrow(HttpError);
    expect(mockedPrisma.playbookRun.create).not.toHaveBeenCalled();
  });

  it("creates a run at pending_approval and starts the Temporal workflow", async () => {
    mockedCatalog.findLatestVersionByKey.mockResolvedValue(resolvedVersion);
    mockedPrisma.playbookRun.create.mockResolvedValue({ id: 5n, state: "pending_approval" });
    mockedClient.startPlaybookRunWorkflow.mockResolvedValue("playbook-run-1-5");
    mockedPrisma.playbookRun.update.mockResolvedValue({ id: 5n, state: "pending_approval", temporalWorkflowId: "playbook-run-1-5" });

    const result = await playbookRunService.startPlaybookRun(
      prisma as never,
      1n,
      2n,
      { incidentId: "2", playbookKey: "enrich-ioc" },
      42n,
    );

    expect(mockedPrisma.playbookRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: "pending_approval", incidentId: 2n }) }),
    );
    expect(mockedClient.startPlaybookRunWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 5n, tenantId: 1n, incidentId: 2n, requestorId: 42n }),
    );
    expect(result.temporalWorkflowId).toBe("playbook-run-1-5");
  });
});

describe("playbookRun.service cancelPlaybookRun", () => {
  afterEach(() => jest.restoreAllMocks());

  it("throws 404 when the run doesn't exist", async () => {
    mockedPrisma.playbookRun.findFirst.mockResolvedValue(null);

    await expect(playbookRunService.cancelPlaybookRun(prisma as never, 99n)).rejects.toThrow(HttpError);
  });

  it("throws 400 when the run already reached a terminal state", async () => {
    mockedPrisma.playbookRun.findFirst.mockResolvedValue({ id: 5n, state: "succeeded", temporalWorkflowId: "wf-1" });

    await expect(playbookRunService.cancelPlaybookRun(prisma as never, 5n)).rejects.toMatchObject({ status: 400 });
  });
});
