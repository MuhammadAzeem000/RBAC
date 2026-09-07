import { ingestStixObject } from "./stixIngest.service";
import { TenantScopedPrisma } from "../middlewares/tenantContext";

function buildMockDb(upsertResult: { id: bigint }) {
  const stixObjectUpsert = jest.fn().mockResolvedValue(upsertResult);
  const outboxEventCreate = jest.fn().mockResolvedValue({});
  const mockTx: Record<string, unknown> = {
    stixObject: { upsert: stixObjectUpsert },
    outboxEvent: { create: outboxEventCreate },
  };
  const db = {
    $transaction: jest.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
  } as unknown as TenantScopedPrisma;
  return { db, stixObjectUpsert, outboxEventCreate };
}

describe("ingestStixObject", () => {
  const ctx = { tenantId: 1n, taxiiServerId: 10n, taxiiCollectionId: 100n, sourceFeedName: "Test Feed" };

  it("upserts a StixObject keyed on [tenantId, stixId]", async () => {
    const { db, stixObjectUpsert } = buildMockDb({ id: 5n });

    await ingestStixObject(
      db,
      { id: "indicator--abc", type: "indicator", pattern: "[ipv4-addr:value = '1.2.3.4']", labels: ["malicious-activity"] },
      ctx,
    );

    expect(stixObjectUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_stixId: { tenantId: ctx.tenantId, stixId: "indicator--abc" } },
      }),
    );
    const call = stixObjectUpsert.mock.calls[0][0];
    expect(call.create.iocType).toBe("ipv4-addr:value");
    expect(call.create.iocValue).toBe("1.2.3.4");
  });

  it("writes an outbox event for indicator objects", async () => {
    const { db, outboxEventCreate } = buildMockDb({ id: 5n });

    await ingestStixObject(db, { id: "indicator--abc", type: "indicator", pattern: "[domain-name:value = 'evil.com']" }, ctx);

    expect(outboxEventCreate).toHaveBeenCalledTimes(1);
    const data = outboxEventCreate.mock.calls[0][0].data;
    expect(data.eventType).toBe("IOC_INGESTED");
    expect(data.aggregateId).toBe("5");
  });

  it("does not write an outbox event for non-indicator objects", async () => {
    const { db, outboxEventCreate } = buildMockDb({ id: 6n });

    await ingestStixObject(db, { id: "malware--abc", type: "malware", name: "Emotet" }, ctx);

    expect(outboxEventCreate).not.toHaveBeenCalled();
  });
});
