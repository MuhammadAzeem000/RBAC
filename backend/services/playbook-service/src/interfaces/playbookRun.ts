import { z } from "zod";

// incidentId is new here — routes are no longer nested under
// incident-service's /incidents/:id/ (see the gateway's separate
// /api/v1/playbook-runs prefix), so the target incident travels in the body
// instead of the URL.
export const startPlaybookRunSchema = z.object({
  incidentId: z
    .string()
    .regex(/^\d+$/, "incidentId must be a numeric id"),
  playbookKey: z.string().trim().min(1).max(100),
  inputs: z.record(z.string(), z.unknown()).optional(),
});

export type StartPlaybookRunInput = z.infer<typeof startPlaybookRunSchema>;

// System-triggered variant (POST /api/v1/playbook-runs/system) — the
// alert-ingestion saga's triggerPlaybookKey, handled by incident-service's
// events/alertConsumer.ts, which has no user JWT to authenticate with (see
// middlewares/requireServiceToken.ts). requestorId carries the alert's
// original requestor as this run's initiator, in place of req.auth.userId.
export const startPlaybookRunSystemSchema = startPlaybookRunSchema.extend({
  tenantId: z.string().regex(/^\d+$/, "tenantId must be a numeric id"),
  requestorId: z.string().regex(/^\d+$/, "requestorId must be a numeric id"),
});

export type StartPlaybookRunSystemInput = z.infer<typeof startPlaybookRunSystemSchema>;
