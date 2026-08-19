import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AccessTokenClaims, AuthTokens, LoginInput, RefreshTokenClaims, RegisterInput } from "../interfaces/auth";
import { UserResponse } from "../interfaces/user";
import { bootstrapFirstAdmin } from "./bootstrap.service";
import { writeOutboxEvent } from "./outbox.service";

const credentialSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  passwordHash: true,
  status: true,
  isActive: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  updatedAt: true,
} as const;

function signToken(payload: object, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

function signAccessToken(user: { id: bigint; email: string }): {
  token: string;
  expiresIn: number;
} {
  const claims: AccessTokenClaims = {
    sub: user.id.toString(),
    email: user.email,
    type: "access",
  };
  const token = signToken(claims, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
  const decoded = jwt.decode(token) as (AccessTokenClaims & { exp?: number }) | null;
  const expiresIn = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;
  return { token, expiresIn };
}

function signRefreshToken(user: { id: bigint }): string {
  const claims: RefreshTokenClaims = {
    sub: user.id.toString(),
    type: "refresh",
  };
  return signToken(claims, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);
}

function issueTokens(user: { id: bigint; email: string }): AuthTokens {
  const { token: accessToken, expiresIn } = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn };
}

export async function login(
  input: LoginInput,
  ip: string | null,
): Promise<{ tokens: AuthTokens; user: UserResponse } | null> {
  const user = await prisma.user.findFirst({
    where: { deletedAt: null, email: input.email },
    select: credentialSelect,
  });
  if (!user || !user.isActive || !user.passwordHash) return null;

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) return null;

  // The lastLoginAt/lastLoginIp write and the LOGIN_SUCCEEDED audit event
  // are the same "business operation" for outbox purposes — one atomic
  // transaction, even though there's no separate mutation being audited.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip ?? undefined },
    });
    await writeOutboxEvent(tx, {
      eventType: "USER_LOGIN_SUCCEEDED",
      aggregateType: "USER",
      aggregateId: user.id.toString(),
      actorId: user.id.toString(),
      action: "LOGIN",
      resourceType: "USER",
      resourceId: user.id.toString(),
      metadata: ip ? { ip } : undefined,
    });
  });

  const { passwordHash: _passwordHash, ...safeUser } = user;
  const tokens = issueTokens(safeUser);
  return { tokens, user: safeUser };
}

// Bootstrap-only: succeeds exactly once, to create the first admin user.
// Returns null once the system has already been initialized (any user
// exists), which the controller maps to a 409 Conflict.
export async function register(input: RegisterInput): Promise<{ tokens: AuthTokens; user: UserResponse } | null> {
  let user: UserResponse;
  try {
    user = await bootstrapFirstAdmin(input);
  } catch {
    return null;
  }

  const tokens = issueTokens(user);
  return { tokens, user };
}

export async function getSessionUser(userId: bigint): Promise<UserResponse | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: credentialSelect,
  });
  if (!user) return null;

  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens | null> {
  let claims: RefreshTokenClaims;
  try {
    claims = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenClaims;
  } catch {
    return null;
  }
  if (claims.type !== "refresh") return null;

  const user = await prisma.user.findFirst({
    where: { id: BigInt(claims.sub), deletedAt: null, isActive: true },
    select: { id: true, email: true },
  });
  if (!user) return null;

  const { token: accessToken, expiresIn } = signAccessToken(user);
  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn };
}
