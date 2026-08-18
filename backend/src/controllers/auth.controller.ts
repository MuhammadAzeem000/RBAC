import { Request, Response } from "express";
import { z } from "zod";
import { loginSchema, refreshSchema, registerSchema } from "../interfaces/auth";
import * as authService from "../services/auth.service";
import * as authzService from "../services/authz.service";

export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const outcome = await authService.login(result.data, req.ip ?? null);
  if (!outcome) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  res.json({ ...outcome.tokens, user: outcome.user });
}

export async function register(req: Request, res: Response) {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const outcome = await authService.register(result.data);
  if (!outcome) {
    res.status(409).json({ error: "The system has already been initialized" });
    return;
  }

  res.status(201).json({ ...outcome.tokens, user: outcome.user });
}

export async function refresh(req: Request, res: Response) {
  const result = refreshSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const tokens = await authService.refreshAccessToken(result.data.refreshToken);
  if (!tokens) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  res.json(tokens);
}

export async function logout(_req: Request, res: Response) {
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  const user = await authService.getSessionUser(req.auth!.userId);
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }
  res.json(user);
}

// Names of the modules the caller's roles grant any permission on — no
// special permission needed beyond being signed in, since this is just
// "what can I see", used to drive nav/menu visibility on the frontend.
export async function myModules(req: Request, res: Response) {
  const names = await authzService.getMyModuleNames(req.auth!.userId);
  res.json({ data: names.map((name) => ({ name, isEnabled: true })) });
}
