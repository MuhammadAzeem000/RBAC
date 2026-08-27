import { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client";

const PRISMA_ERROR_STATUS: Record<string, number> = {
  P2002: 409,
  P2025: 404,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const status = PRISMA_ERROR_STATUS[err.code] ?? 400;
    res.status(status).json({ error: "Database request error" });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: "Invalid request data" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
