import { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client";

const PRISMA_ERROR_STATUS: Record<string, number> = {
  P2002: 409, // unique constraint violation
  P2003: 409, // foreign key constraint violation
  P2025: 404, // record not found
};

function prismaErrorMessage(err: Prisma.PrismaClientKnownRequestError): string {
  if (err.code === "P2002") {
    const target = err.meta?.target;
    const fields = Array.isArray(target) ? target.join(", ") : undefined;
    return fields ? `A record with this ${fields} already exists` : "A record with this value already exists";
  }
  if (err.code === "P2003") {
    return "Referenced record does not exist";
  }
  if (err.code === "P2025") {
    return "Record not found";
  }
  return "Database request error";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const status = PRISMA_ERROR_STATUS[err.code] ?? 400;
    res.status(status).json({ error: prismaErrorMessage(err) });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: "Invalid request data" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
