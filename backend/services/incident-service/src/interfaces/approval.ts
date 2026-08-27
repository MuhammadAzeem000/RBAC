import { z } from "zod";

export const decideApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;

export const listApprovalsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "expired"]).optional(),
});

export type ListApprovalsQuery = z.infer<typeof listApprovalsQuerySchema>;
