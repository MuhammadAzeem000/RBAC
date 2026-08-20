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

/**
 * Wraps a schema so an empty string is treated as "not provided" instead of
 * being validated. Without this, an optional field a form always submits as
 * `""` when left blank (rather than omitting it) fails any format validator
 * (.email(), .url(), a unique-constrained code, ...) that would otherwise
 * happily accept `undefined`.
 */
export function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

