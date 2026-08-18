import { z } from "zod";

export const bigIntId = z.union([z.string(), z.number(), z.bigint()]).transform((value, ctx) => {
  try {
    const id = BigInt(value);
    if (id <= 0n) throw new Error("non-positive");
    return id;
  } catch {
    ctx.addIssue({ code: "custom", message: "Must be a valid positive id" });
    return z.NEVER;
  }
});
