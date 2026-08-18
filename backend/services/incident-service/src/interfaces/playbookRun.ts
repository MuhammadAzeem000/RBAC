import { z } from "zod";

export const startPlaybookRunSchema = z.object({
  playbookKey: z.string().trim().min(1).max(100),
  inputs: z.record(z.string(), z.unknown()).optional(),
});

export type StartPlaybookRunInput = z.infer<typeof startPlaybookRunSchema>;
