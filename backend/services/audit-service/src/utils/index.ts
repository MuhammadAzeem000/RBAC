import { NextFunction, Request, Response } from "express";
import { z, ZodType } from "zod";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function parseQuery<T>(schema: ZodType<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return null;
  }
  return result.data;
}
