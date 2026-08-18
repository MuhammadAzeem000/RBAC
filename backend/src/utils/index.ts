import { NextFunction, Request, Response } from "express";
import { z, ZodType } from "zod";
import { PaginationQuery, paginationQuerySchema } from "../interfaces/pagination";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function parseBigIntId(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function parsePagination(req: Request, res: Response): PaginationQuery | null {
  return parseQuery(paginationQuerySchema, req, res);
}

export function parseQuery<T>(schema: ZodType<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return null;
  }
  return result.data;
}
