import { Prisma } from "../generated/prisma/client";
import { AddEvidenceInput } from "../interfaces/evidence";

export interface EvidenceResponse {
  id: bigint;
  incidentId: bigint;
  filename: string;
  fileType: string | null;
  sizeBytes: bigint | null;
  storageRef: string;
  checksum: string | null;
  provenance: string | null;
  uploadedBy: bigint;
  uploadedAt: Date;
}

const evidenceSelect = {
  id: true,
  incidentId: true,
  filename: true,
  fileType: true,
  sizeBytes: true,
  storageRef: true,
  checksum: true,
  provenance: true,
  uploadedBy: true,
  uploadedAt: true,
} as const;

export function addEvidence(
  db: Prisma.TransactionClient,
  tenantId: bigint,
  incidentId: bigint,
  input: AddEvidenceInput,
  actorUserId: bigint,
): Promise<EvidenceResponse> {
  return db.evidence.create({
    data: {
      // See incident.service.ts::createIncident for why this is passed
      // explicitly even though the tenant-scoping extension overwrites it.
      tenantId,
      incidentId,
      filename: input.filename,
      fileType: input.fileType,
      sizeBytes: input.sizeBytes !== undefined ? BigInt(input.sizeBytes) : undefined,
      storageRef: input.storageRef,
      checksum: input.checksum,
      provenance: input.provenance,
      uploadedBy: actorUserId,
    },
    select: evidenceSelect,
  });
}

export function listEvidence(db: Prisma.TransactionClient, incidentId: bigint): Promise<EvidenceResponse[]> {
  return db.evidence.findMany({
    where: { incidentId },
    select: evidenceSelect,
    orderBy: { uploadedAt: "desc" },
  });
}
