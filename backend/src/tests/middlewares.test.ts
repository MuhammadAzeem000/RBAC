import { Request, Response } from "express";
import { errorHandler } from "../middlewares/errorHandler";
import { notFound } from "../middlewares/notFound";
import { Prisma } from "../generated/prisma/client";

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("mock prisma error", {
    code,
    clientVersion: "test",
    meta,
  });
}

describe("errorHandler", () => {
  it("maps P2002 unique constraint violations to 409", () => {
    const res = mockRes();
    errorHandler(prismaError("P2002", { target: ["email"] }), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "A record with this email already exists" });
  });

  it("maps P2025 not-found errors to 404", () => {
    const res = mockRes();
    errorHandler(prismaError("P2025"), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("falls back to 500 for unknown errors", () => {
    const res = mockRes();
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("boom"), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    spy.mockRestore();
  });
});

describe("notFound", () => {
  it("responds 404 with the requested method and path", () => {
    const res = mockRes();
    const req = { method: "GET", originalUrl: "/api/nope" } as Request;

    notFound(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Route GET /api/nope not found" });
  });
});
