import { lookupIoc, searchIocs } from "../services/iocLookup.service";
import { TenantScopedPrisma } from "../middlewares/tenantContext";

function buildMockDb(findFirstResult: unknown) {
  const findFirst = jest.fn().mockResolvedValue(findFirstResult);
  const findMany = jest.fn().mockResolvedValue([]);
  const db = { stixObject: { findFirst, findMany } } as unknown as TenantScopedPrisma;
  return { db, findFirst, findMany };
}

describe("lookupIoc", () => {
  it("returns found=false when nothing matches", async () => {
    const { db } = buildMockDb(null);
    const result = await lookupIoc(db, "1.2.3.4");
    expect(result).toEqual({ found: false });
  });

  it("filters on iocValue, revoked=false, and optional iocType", async () => {
    const { db, findFirst } = buildMockDb({
      stixId: "indicator--1",
      iocType: "ipv4-addr:value",
      iocValue: "1.2.3.4",
      type: "indicator",
      labels: ["malicious-activity"],
      confidence: 80,
      firstSeen: null,
      lastSeen: null,
      sourceFeedName: "Test Feed",
    });

    const result = await lookupIoc(db, "1.2.3.4", "ipv4-addr:value");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { iocValue: "1.2.3.4", revoked: false, iocType: "ipv4-addr:value" } }),
    );
    expect(result.found).toBe(true);
    expect(result.stixId).toBe("indicator--1");
  });
});

describe("searchIocs", () => {
  it("builds a filtered, paginated query", async () => {
    const { db, findMany } = buildMockDb(null);
    await searchIocs(db, { value: "evil", stixType: "indicator", limit: 10 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ iocValue: { contains: "evil", mode: "insensitive" }, type: "indicator" }),
        take: 10,
      }),
    );
  });
});
