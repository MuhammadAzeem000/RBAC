import { z } from "zod";
import { playbookEdgeSchema, playbookStepSchema } from "@responderx/shared";

// Mirrors the tenant-slug slug pattern used elsewhere in this codebase
// (identity-service's tenantSlugSchema) — a playbook's key is a stable
// identifier used in URLs and by PlaybookRun.playbookKey, immutable once
// created (see services/playbookCatalog.service.ts's publishPlaybookVersion,
// which never lets the key change).
const keySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase alphanumeric, dash-separated");

// Shared by both create (POST /) and publish-a-new-version (PUT /:key) —
// `requiresApproval` is deliberately NOT part of this input (see the
// Playbook Designer plan's decision 3): it's derived server-side from
// whether startPolicyKey is set, so the two can never drift.
export const savePlaybookSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
  startPolicyKey: z.string().trim().min(1).max(100).optional(),
  steps: z.array(playbookStepSchema).min(1, "At least one step is required"),
  // Empty means "no explicit graph" — validatePlaybookGraph (services/) skips
  // structural validation entirely in that case, and the run executes as an
  // implicit linear chain (see @responderx/shared's playbookVersionSchema).
  edges: z.array(playbookEdgeSchema).default([]),
});

export type SavePlaybookInput = z.infer<typeof savePlaybookSchema>;

export const createPlaybookSchema = savePlaybookSchema.extend({ key: keySchema });

export type CreatePlaybookInput = z.infer<typeof createPlaybookSchema>;
