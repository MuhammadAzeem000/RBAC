import { PlaybookStep, playbookStepSchema } from "@responderx/shared";
import { Prisma } from "../generated/prisma/client";

// PlaybookVersion.steps is stored as opaque Json — validated back into the
// shared PlaybookStep shape here, at the one place every consumer resolves
// a version through. An empty/malformed array both fall back to `[]`; the
// caller (playbookRun.service.ts) is what decides an empty list means "run
// one synthetic step" to preserve pre-Temporal behavior for the seeded
// playbooks that predate real step data.
function parseSteps(raw: unknown): PlaybookStep[] {
  const result = playbookStepSchema.array().safeParse(raw);
  return result.success ? result.data : [];
}

// Replaces the old hardcoded PLAYBOOK_CATALOG constant (see
// constants/incidents.ts, now seed data only) with the real, DB-backed,
// versioned catalog. "Latest version" has no explicit flag — a playbook's
// most recently created PlaybookVersion is its current one, matching how
// PLAYBOOK_SEED_DATA's single "1.0" entries behave today; publishing a
// second version later just makes IT the latest, without touching runs
// already pinned to the first (see PlaybookRun.playbookVersionId).

export interface CatalogEntry {
  key: string;
  name: string;
  description: string | null;
  version: string;
  requiresApproval: boolean;
}

const latestVersionInclude = {
  versions: { orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;

export async function getCatalog(db: Prisma.TransactionClient): Promise<CatalogEntry[]> {
  const playbooks = await db.playbook.findMany({
    include: latestVersionInclude,
    orderBy: { key: "asc" },
  });

  return playbooks
    .filter((p) => p.versions.length > 0)
    .map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      version: p.versions[0].version,
      requiresApproval: p.versions[0].requiresApproval,
    }));
}

export interface ResolvedPlaybookVersion {
  playbookVersionId: bigint;
  playbookKey: string;
  playbookName: string;
  version: string;
  requiresApproval: boolean;
  steps: PlaybookStep[];
}

export async function findLatestVersionByKey(
  db: Prisma.TransactionClient,
  key: string,
): Promise<ResolvedPlaybookVersion | null> {
  const playbook = await db.playbook.findFirst({
    where: { key },
    include: latestVersionInclude,
  });
  if (!playbook || playbook.versions.length === 0) return null;

  const version = playbook.versions[0];
  return {
    playbookVersionId: version.id,
    playbookKey: playbook.key,
    playbookName: playbook.name,
    version: version.version,
    requiresApproval: version.requiresApproval,
    steps: parseSteps(version.steps),
  };
}

export async function findVersionById(
  db: Prisma.TransactionClient,
  playbookVersionId: bigint,
): Promise<ResolvedPlaybookVersion | null> {
  const version = await db.playbookVersion.findFirst({
    where: { id: playbookVersionId },
    include: { playbook: true },
  });
  if (!version) return null;

  return {
    playbookVersionId: version.id,
    playbookKey: version.playbook.key,
    playbookName: version.playbook.name,
    version: version.version,
    requiresApproval: version.requiresApproval,
    steps: parseSteps(version.steps),
  };
}
