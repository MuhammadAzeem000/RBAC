// Dev/ops convenience, not runtime application code: seeds PLAYBOOK_SEED_DATA
// and POLICY_SEED_DATA (constants/playbooks.ts) as this tenant's starting
// Playbook/PlaybookVersion catalog and approval policies. Run with
// `npm run db:seed`, or `SEED_TENANT_ID=<id> npm run db:seed` to target a
// specific tenant (defaults to 1, the identity-service `default` tenant
// created by its own first bootstrap).
//
// There's no automatic per-tenant seeding yet — a newly registered tenant
// starts with an empty catalog until this is run against it (same known gap
// as before this service split — unaffected by it).
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/config/prisma";
import { PLAYBOOK_SEED_DATA, POLICY_SEED_DATA } from "../src/constants/playbooks";

async function main() {
  const tenantId = BigInt(process.env.SEED_TENANT_ID ?? "1");

  for (const policy of POLICY_SEED_DATA) {
    await prisma.policy.upsert({
      where: { tenantId_key: { tenantId, key: policy.key } },
      update: {
        name: policy.name,
        timeoutDuration: policy.timeoutDuration,
        escalationAfter: policy.escalationAfter,
        escalationChannel: policy.escalationChannel,
      },
      create: {
        tenantId,
        key: policy.key,
        name: policy.name,
        timeoutDuration: policy.timeoutDuration,
        escalationAfter: policy.escalationAfter,
        escalationChannel: policy.escalationChannel,
      },
    });
    console.log(`Seeded policy "${policy.key}" for tenant ${tenantId}`);
  }

  for (const entry of PLAYBOOK_SEED_DATA) {
    const playbook = await prisma.playbook.upsert({
      where: { tenantId_key: { tenantId, key: entry.key } },
      update: { name: entry.name, description: entry.description },
      create: { tenantId, key: entry.key, name: entry.name, description: entry.description },
    });

    const steps = entry.steps as unknown as Prisma.InputJsonValue;
    await prisma.playbookVersion.upsert({
      where: { playbookId_version: { playbookId: playbook.id, version: "1.0" } },
      update: { requiresApproval: entry.requiresApproval, startPolicyKey: entry.startPolicyKey, steps },
      create: {
        tenantId,
        playbookId: playbook.id,
        version: "1.0",
        requiresApproval: entry.requiresApproval,
        startPolicyKey: entry.startPolicyKey,
        steps,
      },
    });

    console.log(`Seeded playbook "${entry.key}" (v1.0, ${entry.steps.length} step(s)) for tenant ${tenantId}`);
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
