import "../utils/bigint";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import * as authService from "../services/auth.service";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/authenticate";
import { bootstrapFirstAdmin } from "../services/bootstrap.service";

jest.mock("../config/prisma", () => ({
  prisma: {
    user: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

jest.mock("../services/bootstrap.service");

const mockedPrisma = prisma as unknown as {
  user: { findFirst: jest.Mock; update: jest.Mock };
};
const mockedBcryptCompare = bcrypt.compare as jest.Mock;

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

const loginInput = { email: "alice@example.com", password: "supersecret" };

describe("auth.service login", () => {
  it("returns null when no matching active user is found", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(null);

    const result = await authService.login(loginInput, "127.0.0.1");

    expect(result).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 1n,
      email: "alice@example.com",
      isActive: true,
      passwordHash: "hashed",
    });
    mockedBcryptCompare.mockResolvedValue(false);

    const result = await authService.login(loginInput, "127.0.0.1");

    expect(result).toBeNull();
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("issues tokens and records the login on success", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 1n,
      email: "alice@example.com",
      isActive: true,
      passwordHash: "hashed",
    });
    mockedBcryptCompare.mockResolvedValue(true);
    mockedPrisma.user.update.mockResolvedValue({});

    const result = await authService.login(loginInput, "127.0.0.1");

    expect(result).not.toBeNull();
    expect(result?.tokens.tokenType).toBe("Bearer");
    expect(typeof result?.tokens.accessToken).toBe("string");
    expect(typeof result?.tokens.refreshToken).toBe("string");
    expect(result?.user).not.toHaveProperty("passwordHash");
    expect(mockedPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: expect.objectContaining({ lastLoginAt: expect.any(Date), lastLoginIp: "127.0.0.1" }),
      }),
    );

    const decoded = jwt.verify(result!.tokens.accessToken, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.sub).toBe("1");
    expect(decoded.type).toBe("access");
  });
});

describe("auth.service getSessionUser", () => {
  it("returns null when the user no longer exists", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    expect(await authService.getSessionUser(1n)).toBeNull();
  });

  it("strips passwordHash", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 6n,
      email: "admin@example.com",
      passwordHash: "hashed",
    });

    const result = await authService.getSessionUser(6n);

    expect(result).not.toHaveProperty("passwordHash");
  });
});

describe("auth.service register", () => {
  const registerInput = { name: "Alice Admin", email: "alice@example.com", password: "supersecret" };

  it("bootstraps the first admin and issues tokens", async () => {
    (bootstrapFirstAdmin as jest.Mock).mockResolvedValue({ id: 2n, email: "alice@example.com" });

    const result = await authService.register(registerInput);

    expect(bootstrapFirstAdmin).toHaveBeenCalledWith(registerInput);
    expect(result).not.toBeNull();
    expect(result?.tokens.tokenType).toBe("Bearer");
    expect(result?.user).not.toHaveProperty("passwordHash");

    const decoded = jwt.verify(result!.tokens.accessToken, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded.sub).toBe("2");
  });

  it("returns null when the system is already initialized", async () => {
    (bootstrapFirstAdmin as jest.Mock).mockRejectedValue(new Error("System already initialized"));

    const result = await authService.register(registerInput);

    expect(result).toBeNull();
  });
});

describe("auth.service refreshAccessToken", () => {
  it("returns null for a garbage token", async () => {
    const result = await authService.refreshAccessToken("not-a-real-token");
    expect(result).toBeNull();
  });

  it("returns null when the access secret is used instead of the refresh secret", async () => {
    const token = jwt.sign({ sub: "1", type: "refresh" }, env.JWT_ACCESS_SECRET);
    const result = await authService.refreshAccessToken(token);
    expect(result).toBeNull();
  });

  it("issues a fresh access token and echoes the same refresh token", async () => {
    const refreshToken = jwt.sign({ sub: "1", type: "refresh" }, env.JWT_REFRESH_SECRET);
    mockedPrisma.user.findFirst.mockResolvedValue({ id: 1n, email: "alice@example.com" });

    const tokens = await authService.refreshAccessToken(refreshToken);

    expect(tokens).not.toBeNull();
    expect(tokens?.refreshToken).toBe(refreshToken);
    expect(typeof tokens?.accessToken).toBe("string");
  });

  it("returns null when the user behind the token no longer exists", async () => {
    const refreshToken = jwt.sign({ sub: "1", type: "refresh" }, env.JWT_REFRESH_SECRET);
    mockedPrisma.user.findFirst.mockResolvedValue(null);

    const tokens = await authService.refreshAccessToken(refreshToken);

    expect(tokens).toBeNull();
  });
});

describe("auth.controller", () => {
  it("login responds 400 on malformed input", async () => {
    const req = { body: { email: "not-an-email" } } as unknown as Request;
    const res = mockRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("login responds 401 when credentials are rejected", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    const req = { body: loginInput, ip: "127.0.0.1" } as unknown as Request;
    const res = mockRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("refresh responds 401 for an invalid refresh token", async () => {
    const req = { body: { refreshToken: "bad" } } as unknown as Request;
    const res = mockRes();

    await authController.refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("register responds 400 for invalid input", async () => {
    const req = {
      body: { name: "Alice", email: "not-an-email", password: "supersecret" },
    } as unknown as Request;
    const res = mockRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bootstrapFirstAdmin).not.toHaveBeenCalled();
  });

  it("register responds 201 with tokens on success", async () => {
    (bootstrapFirstAdmin as jest.Mock).mockResolvedValue({ id: 2n, email: "alice@example.com" });
    const req = {
      body: { name: "Alice", email: "alice@example.com", password: "supersecret" },
    } as unknown as Request;
    const res = mockRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("register responds 409 when the system is already initialized", async () => {
    (bootstrapFirstAdmin as jest.Mock).mockRejectedValue(new Error("System already initialized"));
    const req = {
      body: { name: "Alice", email: "alice@example.com", password: "supersecret" },
    } as unknown as Request;
    const res = mockRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("me responds 401 when the user no longer exists", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue(null);
    const req = { auth: { userId: 1n, email: "alice@example.com" } } as unknown as Request;
    const res = mockRes();

    await authController.me(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("me returns the session user", async () => {
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 6n,
      email: "admin@example.com",
      passwordHash: "hashed",
    });
    const req = {
      auth: { userId: 6n, email: "admin@example.com" },
    } as unknown as Request;
    const res = mockRes();

    await authController.me(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 6n, email: "admin@example.com" }));
  });
});

describe("authenticate middleware", () => {
  function mockNext() {
    return jest.fn();
  }

  it("rejects requests without an Authorization header", () => {
    const req = { headers: {} } as unknown as Request;
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a refresh token presented as an access token", () => {
    const token = jwt.sign({ sub: "1", type: "refresh" }, env.JWT_ACCESS_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches auth context and calls next for a valid access token", () => {
    const token = jwt.sign({ sub: "42", email: "alice@example.com", type: "access" }, env.JWT_ACCESS_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth).toEqual({ userId: 42n, email: "alice@example.com" });
  });
});
