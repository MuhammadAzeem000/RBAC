import { prisma } from "../config/prisma";
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
  incidentId: bigint,
  input: AddEvidenceInput,
  actorUserId: bigint,
): Promise<EvidenceResponse> {
  return prisma.evidence.create({
    data: {
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

export function listEvidence(incidentId: bigint): Promise<EvidenceResponse[]> {
  return prisma.evidence.findMany({
    where: { incidentId },
    select: evidenceSelect,
    orderBy: { uploadedAt: "desc" },
  });
}
