import { PlaybookEdge, PlaybookStep, playbookEdgeSchema, playbookStepSchema } from "@responderx/shared";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../middlewares/errorHandler";
import { CreatePlaybookInput, SavePlaybookInput } from "../interfaces/playbook";
import { validatePlaybookGraph } from "../utils/playbookGraph";
import { writeOutboxEvent } from "./outbox.service";

// PlaybookVersion.steps/edges are stored as opaque Json — validated back
// into the shared shapes here, at the one place every consumer resolves a
// version through. An empty/malformed array both fall back to `[]`; the
// caller (playbookRun.service.ts / the Temporal workflow's graph.ts) is
// what decides an empty steps list means "run one synthetic step", and an
// empty edges list means "treat steps as an implicit linear chain".
function parseSteps(raw: unknown): PlaybookStep[] {
  const result = playbookStepSchema.array().safeParse(raw);
  return result.success ? result.data : [];
}

function parseEdges(raw: unknown): PlaybookEdge[] {
  const result = playbookEdgeSchema.array().safeParse(raw);
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
  startPolicyKey: string | null;
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
      startPolicyKey: p.versions[0].startPolicyKey,
    }));
}

export interface ResolvedPlaybookVersion {
  playbookVersionId: bigint;
  playbookKey: string;
  playbookName: string;
  version: string;
  requiresApproval: boolean;
  startPolicyKey: string | null;
  steps: PlaybookStep[];
  edges: PlaybookEdge[];
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
    startPolicyKey: version.startPolicyKey,
    steps: parseSteps(version.steps),
    edges: parseEdges(version.edges),
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
    startPolicyKey: version.startPolicyKey,
    steps: parseSteps(version.steps),
    edges: parseEdges(version.edges),
  };
}

// ---- Playbook Designer: authoring API (creates/publishes real rows,
// replacing prisma/seed.ts as the only way a playbook comes to exist) ----

export interface PlaybookSummary {
  key: string;
  name: string;
  description: string | null;
  version: string;
  requiresApproval: boolean;
  startPolicyKey: string | null;
  stepCount: number;
  createdAt: Date;
}

export interface PlaybookDetail extends Omit<PlaybookSummary, "stepCount"> {
  steps: PlaybookStep[];
  edges: PlaybookEdge[];
  versions: { version: string; createdAt: Date }[];
}

export async function listPlaybooksDetailed(db: Prisma.TransactionClient): Promise<PlaybookSummary[]> {
  const playbooks = await db.playbook.findMany({ include: latestVersionInclude, orderBy: { key: "asc" } });

  return playbooks
    .filter((p) => p.versions.length > 0)
    .map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      version: p.versions[0].version,
      requiresApproval: p.versions[0].requiresApproval,
      startPolicyKey: p.versions[0].startPolicyKey,
      stepCount: parseSteps(p.versions[0].steps).length,
      createdAt: p.createdAt,
    }));
}

export async function getPlaybookDetail(db: Prisma.TransactionClient, key: string): Promise<PlaybookDetail | null> {
  const playbook = await db.playbook.findFirst({
    where: { key },
    include: { versions: { orderBy: { createdAt: "desc" } } },
  });
  if (!playbook || playbook.versions.length === 0) return null;

  const latest = playbook.versions[0];
  return {
    key: playbook.key,
    name: playbook.name,
    description: playbook.description,
    version: latest.version,
    requiresApproval: latest.requiresApproval,
    startPolicyKey: latest.startPolicyKey,
    steps: parseSteps(latest.steps),
    edges: parseEdges(latest.edges),
    versions: playbook.versions.map((v) => ({ version: v.version, createdAt: v.createdAt })),
    createdAt: playbook.createdAt,
  };
}

// `requiresApproval` is derived here, not accepted as input — see
// interfaces/playbook.ts's comment on savePlaybookSchema (Playbook
// Designer plan, decision 3): it must never drift from whether
// startPolicyKey is actually set.
export async function createPlaybook(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  input: CreatePlaybookInput,
  actorUserId: bigint,
): Promise<PlaybookDetail> {
  validatePlaybookGraph(input.steps, input.edges);
  const requiresApproval = Boolean(input.startPolicyKey);

  const playbook = await db.$transaction(async (tx) => {
    const created = await tx.playbook.create({
      data: { tenantId, key: input.key, name: input.name, description: input.description },
    });
    const version = await tx.playbookVersion.create({
      data: {
        tenantId,
        playbookId: created.id,
        version: "1.0",
        requiresApproval,
        startPolicyKey: input.startPolicyKey,
        steps: input.steps as unknown as Prisma.InputJsonValue,
        edges: input.edges as unknown as Prisma.InputJsonValue,
      },
    });

    await writeOutboxEvent(tx, {
      tenantId,
      eventType: "PLAYBOOK_CREATED",
      aggregateType: "PLAYBOOK",
      aggregateId: created.id.toString(),
      actorId: actorUserId.toString(),
      action: "CREATE",
      resourceType: "PLAYBOOK",
      resourceId: created.id.toString(),
      metadata: { key: created.key, version: version.version },
    });

    return created;
  });

  return (await getPlaybookDetail(db, playbook.key))!;
}

// A version is immutable once created (see PlaybookVersion's own schema
// comment) — "editing" an existing playbook publishes a new version rather
// than mutating one, computed as the next sequential integer so it stays
// compatible with the seed data's "1.0"-style format.
export async function publishPlaybookVersion(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  key: string,
  input: SavePlaybookInput,
  actorUserId: bigint,
): Promise<PlaybookDetail> {
  const playbook = await db.playbook.findFirst({ where: { key }, include: { versions: true } });
  if (!playbook) {
    throw new HttpError(404, `Playbook "${key}" not found`);
  }

  validatePlaybookGraph(input.steps, input.edges);

  const nextVersion = `${playbook.versions.length + 1}.0`;
  const requiresApproval = Boolean(input.startPolicyKey);

  await db.$transaction(async (tx) => {
    await tx.playbook.update({
      where: { id: playbook.id },
      data: { name: input.name, description: input.description },
    });
    const version = await tx.playbookVersion.create({
      data: {
        tenantId,
        playbookId: playbook.id,
        version: nextVersion,
        requiresApproval,
        startPolicyKey: input.startPolicyKey,
        steps: input.steps as unknown as Prisma.InputJsonValue,
        edges: input.edges as unknown as Prisma.InputJsonValue,
      },
    });

    await writeOutboxEvent(tx, {
      tenantId,
      eventType: "PLAYBOOK_VERSION_PUBLISHED",
      aggregateType: "PLAYBOOK",
      aggregateId: playbook.id.toString(),
      actorId: actorUserId.toString(),
      action: "UPDATE",
      resourceType: "PLAYBOOK",
      resourceId: playbook.id.toString(),
      metadata: { key, version: version.version },
    });
  });

  return (await getPlaybookDetail(db, key))!;
}
