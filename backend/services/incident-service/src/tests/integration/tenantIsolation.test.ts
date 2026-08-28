// Real-database integration test — the exit gate for Phase 1's tenant
// isolation requirement: "an automated test proves a user in tenant A
// cannot read/write/search tenant B's data." Everything else in this
// codebase's test suite mocks Prisma; this is deliberately the exception.
//
// Run with `npm run test:integration` against a real Postgres — point
// DB_NAME at a disposable test database first, e.g.:
//   docker exec -e DB_NAME=incident_test_db responderx-incident-service-1 npx prisma migrate deploy
//   docker exec -e DB_NAME=incident_test_db responderx-incident-service-1 npm run test:integration
import { forTenant } from "@responderx/shared";
import { prisma } from "../../config/prisma";
import * as incidentService from "../../services/incident.service";

const TENANT_SCOPED_MODELS = ["Incident", "Task", "Evidence", "Comment", "TimelineEvent", "OutboxEvent"] as const;

function uniqueTitle(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

describe("tenant isolation", () => {
  const tenantAId = BigInt(Date.now());
  const tenantBId = tenantAId + 1n;
  const actorUserId = 1n;

  function dbFor(tenantId: bigint) {
    return forTenant(prisma, tenantId, TENANT_SCOPED_MODELS);
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("an incident created in tenant A is invisible to tenant B", async () => {
    const dbA = dbFor(tenantAId);
    const dbB = dbFor(tenantBId);

    const incident = await incidentService.createIncident(
      dbA,
      tenantAId,
      { title: uniqueTitle("Phishing campaign"), severity: "high" },
      actorUserId,
    );

    const fromB = await incidentService.getIncidentById(dbB, incident.id);
    expect(fromB).toBeNull();

    const fromA = await incidentService.getIncidentById(dbA, incident.id);
    expect(fromA?.id).toBe(incident.id);

    const { data: listB } = await incidentService.listIncidents(dbB, {
      page: 1,
      pageSize: 50,
      sortBy: "createdAt",
      sortDir: "desc",
    });
    expect(listB.map((i) => i.id)).not.toContain(incident.id);
  });

  it("updating another tenant's incident throws and leaves it unchanged", async () => {
    const dbA = dbFor(tenantAId);
    const dbB = dbFor(tenantBId);

    const incident = await incidentService.createIncident(
      dbA,
      tenantAId,
      { title: uniqueTitle("Ransomware"), severity: "critical" },
      actorUserId,
    );

    await expect(
      incidentService.updateIncident(dbB, tenantBId, incident.id, { title: "Hijacked" }, actorUserId),
    ).rejects.toThrow();

    const unchanged = await incidentService.getIncidentById(dbA, incident.id);
    expect(unchanged?.title).not.toBe("Hijacked");
  });

  it("assertIncidentExists 404s for another tenant's incident, not just a nonexistent one", async () => {
    const dbA = dbFor(tenantAId);
    const dbB = dbFor(tenantBId);

    const incident = await incidentService.createIncident(
      dbA,
      tenantAId,
      { title: uniqueTitle("Data exfiltration"), severity: "high" },
      actorUserId,
    );

    await expect(incidentService.assertIncidentExists(dbB, incident.id)).rejects.toThrow("Incident not found");
    await expect(incidentService.assertIncidentExists(dbA, incident.id)).resolves.toBeUndefined();
  });

  it("create stamps the caller's tenantId regardless of what's passed", async () => {
    const dbA = dbFor(tenantAId);
    const incident = await dbA.incident.create({
      data: {
        tenantId: tenantBId, // deliberately wrong — must be overwritten
        title: uniqueTitle("Spoof attempt"),
        severity: "low",
        status: "new",
        createdBy: actorUserId,
      },
    });

    expect(incident.tenantId).toBe(tenantAId);
  });
});
