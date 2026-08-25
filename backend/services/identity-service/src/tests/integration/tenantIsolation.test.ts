// Real-database integration test — the exit gate for Phase 1's tenant
// isolation requirement: "an automated test proves a user in tenant A
// cannot read/write/search tenant B's data." Everything else in this
// codebase's test suite mocks Prisma; this is deliberately the exception.
//
// Run with `npm run test:integration` against a real Postgres — point
// DB_NAME at a disposable test database first, e.g.:
//   docker exec -e DB_NAME=identity_test_db responderx-identity-service-1 npx prisma migrate deploy
//   docker exec -e DB_NAME=identity_test_db responderx-identity-service-1 npm run test:integration
import { forTenant } from "@responderx/shared";
import { prisma } from "../../config/prisma";

const TENANT_SCOPED_MODELS = ["User", "Department", "UserRole", "UserDepartment"] as const;

function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

describe("tenant isolation", () => {
  let tenantA: { id: bigint };
  let tenantB: { id: bigint };
  let userA: { id: bigint };
  let userB: { id: bigint };
  let deptA: { id: bigint };

  beforeAll(async () => {
    tenantA = await prisma.tenant.create({ data: { slug: uniqueSlug("tenant-a"), name: "Tenant A" } });
    tenantB = await prisma.tenant.create({ data: { slug: uniqueSlug("tenant-b"), name: "Tenant B" } });

    userA = await prisma.user.create({
      data: { tenantId: tenantA.id, name: "Alice", email: `alice-${Date.now()}@tenant-a.test` },
    });
    userB = await prisma.user.create({
      data: { tenantId: tenantB.id, name: "Bob", email: `bob-${Date.now()}@tenant-b.test` },
    });
    deptA = await prisma.department.create({ data: { tenantId: tenantA.id, name: uniqueSlug("Security") } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function dbFor(tenantId: bigint) {
    return forTenant(prisma, tenantId, TENANT_SCOPED_MODELS);
  }

  it("a tenant-scoped client only lists its own tenant's users", async () => {
    const dbA = dbFor(tenantA.id);
    const users = await dbA.user.findMany({ where: { deletedAt: null } });

    expect(users.map((u) => u.id)).toContain(userA.id);
    expect(users.map((u) => u.id)).not.toContain(userB.id);
  });

  it("findFirst by id returns null for another tenant's user", async () => {
    const dbB = dbFor(tenantB.id);
    const found = await dbB.user.findFirst({ where: { id: userA.id } });

    expect(found).toBeNull();
  });

  it("findFirst by id succeeds for the caller's own tenant", async () => {
    const dbA = dbFor(tenantA.id);
    const found = await dbA.user.findFirst({ where: { id: userA.id } });

    expect(found?.id).toBe(userA.id);
  });

  it("update on another tenant's user throws instead of silently succeeding or cross-tenant-writing", async () => {
    const dbB = dbFor(tenantB.id);

    await expect(dbB.user.update({ where: { id: userA.id }, data: { name: "Hijacked" } })).rejects.toThrow();

    // Confirm the row was genuinely untouched, not just that some error was thrown.
    const stillAlice = await prisma.user.findFirst({ where: { id: userA.id } });
    expect(stillAlice?.name).toBe("Alice");
  });

  it("update on the caller's own tenant's user succeeds", async () => {
    const dbA = dbFor(tenantA.id);
    const updated = await dbA.user.update({ where: { id: userA.id }, data: { name: "Alice Updated" } });

    expect(updated.name).toBe("Alice Updated");
  });

  it("create stamps the caller's tenantId regardless of what's passed", async () => {
    const dbA = dbFor(tenantA.id);
    // tenantId here is deliberately wrong (tenantB's) — the extension must
    // overwrite it, never trust a caller-supplied value.
    const created = await dbA.user.create({
      data: { tenantId: tenantB.id, name: "Eve", email: `eve-${Date.now()}@spoofed.test` },
    });

    expect(created.tenantId).toBe(tenantA.id);
  });

  it("count only reflects the caller's own tenant", async () => {
    const dbA = dbFor(tenantA.id);
    const dbB = dbFor(tenantB.id);

    const countA = await dbA.department.count();
    const countB = await dbB.department.count();

    expect(countA).toBeGreaterThanOrEqual(1);
    expect(countB).toBe(0);
  });

  it("a client scoped with tenantId: null bypasses scoping (Platform Operator escape hatch)", async () => {
    const unscoped = forTenant(prisma, null, TENANT_SCOPED_MODELS);
    const found = await unscoped.user.findFirst({ where: { id: userB.id } });

    expect(found?.id).toBe(userB.id);
  });

  it("cross-tenant delete is rejected the same way update is", async () => {
    const dbB = dbFor(tenantB.id);
    await expect(dbB.department.delete({ where: { id: deptA.id } })).rejects.toThrow();

    const stillThere = await prisma.department.findFirst({ where: { id: deptA.id } });
    expect(stillThere).not.toBeNull();
  });
});
