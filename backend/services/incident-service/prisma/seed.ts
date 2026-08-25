// Dev/ops convenience, not runtime application code: seeds PLAYBOOK_SEED_DATA
// (constants/incidents.ts) as this tenant's starting Playbook/PlaybookVersion
// catalog. Run with `npm run db:seed`, or `SEED_TENANT_ID=<id> npm run db:seed`
// to target a specific tenant (defaults to 1, the identity-service `default`
// tenant created by its own first bootstrap).
//
// There's no automatic per-tenant seeding yet — a newly registered tenant
// starts with an empty catalog until this is run against it. Wiring
// incident-service to auto-seed on the TENANT_CREATED event
// identity-service already publishes is a natural follow-up, not built here
// to keep this phase's scope to "make the catalog real," not "automate
// onboarding."
import { prisma } from "../src/config/prisma";
import { PLAYBOOK_SEED_DATA } from "../src/constants/incidents";

async function main() {
  const tenantId = BigInt(process.env.SEED_TENANT_ID ?? "1");

  for (const entry of PLAYBOOK_SEED_DATA) {
    const playbook = await prisma.playbook.upsert({
      where: { tenantId_key: { tenantId, key: entry.key } },
      update: { name: entry.name, description: entry.description },
      create: { tenantId, key: entry.key, name: entry.name, description: entry.description },
    });

    await prisma.playbookVersion.upsert({
      where: { playbookId_version: { playbookId: playbook.id, version: "1.0" } },
      update: { requiresApproval: entry.requiresApproval },
      create: {
        tenantId,
        playbookId: playbook.id,
        version: "1.0",
        requiresApproval: entry.requiresApproval,
        steps: [],
      },
    });

    console.log(`Seeded playbook "${entry.key}" (v1.0) for tenant ${tenantId}`);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
