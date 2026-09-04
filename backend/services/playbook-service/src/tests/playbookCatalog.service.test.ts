import "../utils/bigint";
import { prisma } from "../config/prisma";
import * as playbookCatalogService from "../services/playbookCatalog.service";
import { HttpError } from "../middlewares/errorHandler";

jest.mock("../config/prisma", () => {
  const resources = {
    playbook: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    playbookVersion: { create: jest.fn() },
    outboxEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  // createPlaybook/publishPlaybookVersion wrap their writes in
  // db.$transaction(async (tx) => ...) — running the callback against
  // these SAME mocked resources lets tx.playbook.create(...) etc. resolve
  // to the same jest.fn() the tests assert against. Mirrors
  // playbookRun.service.test.ts's mocking pattern.
  return { prisma: { ...resources, $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(resources)) } };
});

const mockedPrisma = prisma as unknown as {
  playbook: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
  playbookVersion: { create: jest.Mock };
};

const baseInput = {
  name: "Test Playbook",
  steps: [{ key: "step-1", name: "Step 1", config: {} }],
  edges: [],
};

describe("playbookCatalog.service createPlaybook", () => {
  afterEach(() => jest.restoreAllMocks());

  it("derives requiresApproval:false when no startPolicyKey is given", async () => {
    mockedPrisma.playbook.create.mockResolvedValue({ id: 1n, key: "test-playbook" });
    mockedPrisma.playbookVersion.create.mockResolvedValue({ version: "1.0" });
    mockedPrisma.playbook.findFirst.mockResolvedValue({
      id: 1n,
      key: "test-playbook",
      name: "Test Playbook",
      description: null,
      createdAt: new Date(),
      versions: [{ version: "1.0", requiresApproval: false, startPolicyKey: null, steps: baseInput.steps, createdAt: new Date() }],
    });

    await playbookCatalogService.createPlaybook(prisma as never, 1n, { ...baseInput, key: "test-playbook" }, 42n);

    expect(mockedPrisma.playbookVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requiresApproval: false, startPolicyKey: undefined, version: "1.0" }) }),
    );
  });

  it("derives requiresApproval:true when a startPolicyKey is given", async () => {
    mockedPrisma.playbook.create.mockResolvedValue({ id: 2n, key: "gated-playbook" });
    mockedPrisma.playbookVersion.create.mockResolvedValue({ version: "1.0" });
    mockedPrisma.playbook.findFirst.mockResolvedValue({
      id: 2n,
      key: "gated-playbook",
      name: "Gated",
      description: null,
      createdAt: new Date(),
      versions: [{ version: "1.0", requiresApproval: true, startPolicyKey: "disruptive-action", steps: baseInput.steps, createdAt: new Date() }],
    });

    await playbookCatalogService.createPlaybook(
      prisma as never,
      1n,
      { ...baseInput, key: "gated-playbook", startPolicyKey: "disruptive-action" },
      42n,
    );

    expect(mockedPrisma.playbookVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requiresApproval: true, startPolicyKey: "disruptive-action" }) }),
    );
  });
});

describe("playbookCatalog.service publishPlaybookVersion", () => {
  afterEach(() => jest.restoreAllMocks());

  it("throws 404 when the playbook key doesn't exist", async () => {
    mockedPrisma.playbook.findFirst.mockResolvedValue(null);

    await expect(
      playbookCatalogService.publishPlaybookVersion(prisma as never, 1n, "nonexistent", baseInput, 42n),
    ).rejects.toThrow(HttpError);
  });

  it("computes the next version as {existingVersionCount + 1}.0", async () => {
    mockedPrisma.playbook.findFirst
      .mockResolvedValueOnce({ id: 3n, versions: [{}, {}] }) // existing lookup: 2 prior versions
      .mockResolvedValueOnce({
        id: 3n,
        key: "existing-playbook",
        name: "Existing",
        description: null,
        createdAt: new Date(),
        versions: [{ version: "3.0", requiresApproval: false, startPolicyKey: null, steps: baseInput.steps, createdAt: new Date() }],
      });
    mockedPrisma.playbookVersion.create.mockResolvedValue({ version: "3.0" });

    await playbookCatalogService.publishPlaybookVersion(prisma as never, 1n, "existing-playbook", baseInput, 42n);

    expect(mockedPrisma.playbookVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: "3.0" }) }),
    );
  });
});
