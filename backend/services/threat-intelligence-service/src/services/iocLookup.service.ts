import { TenantScopedPrisma } from "../middlewares/tenantContext";

export interface IocLookupResult {
  found: boolean;
  stixId?: string;
  iocType?: string | null;
  iocValue?: string | null;
  type?: string;
  labels?: string[];
  confidence?: number | null;
  firstSeen?: Date | null;
  lastSeen?: Date | null;
  sourceFeedName?: string | null;
}

// The primary future-connector/enrichment seam: "have we seen this IOC
// value before" — backed by the @@index([tenantId, iocType, iocValue]) on
// StixObject, an indexed equality lookup rather than a JSONB scan.
export async function lookupIoc(
  db: TenantScopedPrisma,
  value: string,
  iocType?: string,
): Promise<IocLookupResult> {
  const match = await db.stixObject.findFirst({
    where: {
      iocValue: value,
      revoked: false,
      ...(iocType ? { iocType } : {}),
    },
    orderBy: { lastSeen: "desc" },
  });

  if (!match) return { found: false };

  return {
    found: true,
    stixId: match.stixId,
    iocType: match.iocType,
    iocValue: match.iocValue,
    type: match.type,
    labels: match.labels,
    confidence: match.confidence,
    firstSeen: match.firstSeen,
    lastSeen: match.lastSeen,
    sourceFeedName: match.sourceFeedName,
  };
}

export interface SearchIocsOptions {
  value?: string;
  iocType?: string;
  stixType?: string;
  limit?: number;
}

export async function searchIocs(db: TenantScopedPrisma, options: SearchIocsOptions) {
  return db.stixObject.findMany({
    where: {
      ...(options.value ? { iocValue: { contains: options.value, mode: "insensitive" } } : {}),
      ...(options.iocType ? { iocType: options.iocType } : {}),
      ...(options.stixType ? { type: options.stixType } : {}),
    },
    orderBy: { ingestedAt: "desc" },
    take: options.limit ?? 50,
  });
}
