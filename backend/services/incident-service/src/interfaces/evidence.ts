import { z } from "zod";

export const addEvidenceSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  fileType: z.string().trim().max(100).optional(),
  sizeBytes: z.coerce.number().int().nonnegative().optional(),
  storageRef: z.string().trim().min(1).max(500),
  checksum: z.string().trim().max(128).optional(),
  provenance: z.string().trim().max(2_000).optional(),
});

export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;
