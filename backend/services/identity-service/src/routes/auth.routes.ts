import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/authenticate";
import { asyncHandler } from "../utils";

export const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a tenant's first admin
 *     description: >
 *       Creates a tenant (by tenantSlug) if it doesn't already exist, using tenantName or the slug itself, then
 *       creates the registering user as that tenant's first admin. Rejected once the tenant already has an admin —
 *       this endpoint never creates an arbitrary account, only a tenant's bootstrap admin.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, tenantSlug]
 *             properties:
 *               name: { type: string, maxLength: 150 }
 *               email: { type: string, format: email, maxLength: 255 }
 *               password: { type: string, minLength: 8, maxLength: 255 }
 *               tenantSlug:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 63
 *                 pattern: '^[a-z0-9]+(-[a-z0-9]+)*$'
 *               tenantName: { type: string, maxLength: 150 }
 *     responses:
 *       201:
 *         description: Access/refresh tokens plus the created user.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: The tenant has already been initialized (already has an admin).
 */
authRouter.post("/register", asyncHandler(authController.register));

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in
 *     description: Email is unique per tenant, not globally, so tenantSlug identifies which tenant to look the account up in.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantSlug, email, password]
 *             properties:
 *               tenantSlug:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 63
 *                 pattern: '^[a-z0-9]+(-[a-z0-9]+)*$'
 *               email: { type: string, format: email, maxLength: 255 }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Access/refresh tokens plus the authenticated user.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Invalid credentials.
 */
authRouter.post("/login", asyncHandler(authController.login));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new token pair
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: A new accessToken/refreshToken pair.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Invalid or expired refresh token.
 */
authRouter.post("/refresh", asyncHandler(authController.refresh));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out
 *     description: Stateless on this service's side — the client is expected to discard its tokens; there's nothing to revoke server-side.
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Logged out.
 *       401:
 *         description: Missing or invalid access token.
 */
authRouter.post("/logout", authenticate, asyncHandler(authController.logout));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the caller's own user record
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: The authenticated user.
 *       401:
 *         description: Missing or invalid access token, or the user no longer exists.
 */
authRouter.get("/me", authenticate, asyncHandler(authController.me));

/**
 * @openapi
 * /auth/me/modules:
 *   get:
 *     summary: List the modules/actions the caller's roles grant
 *     description: Drives nav visibility and per-action (create/edit/delete) control gating on the frontend. No permission needed beyond being signed in.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: The modules the caller can see, each with the action names they're granted on it.
 *       401:
 *         description: Missing or invalid access token.
 */
authRouter.get("/me/modules", authenticate, asyncHandler(authController.myModules));
