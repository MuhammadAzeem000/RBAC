import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AccessTokenClaims } from "../interfaces/auth";

export interface AuthContext {
  userId: bigint;
  email: string;
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
    if (claims.type !== "access") {
      throw new Error("wrong token type");
    }

    req.auth = {
      userId: BigInt(claims.sub),
      email: claims.email,
      token,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
