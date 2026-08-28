import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AccessTokenClaims } from "../interfaces/auth";

export interface AuthContext {
  userId: bigint;
  email: string;
  tenantId: bigint;
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

    // Kept alongside userId/email so requireIncidentPermission/
    // requireApprovalPermission can forward the same token to
    // identity-service, and so the incident-existence check
    // (services/incidentClient.service.ts) can forward it to incident-service.
    req.auth = {
      userId: BigInt(claims.sub),
      email: claims.email,
      tenantId: BigInt(claims.tenantId),
      token,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
