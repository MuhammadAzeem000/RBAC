import { Router } from "express";
import * as policyController from "../controllers/policy.controller";
import { ACTION_NAMES } from "../constants/module";
import { requirePlaybookPermission } from "../middlewares/requirePlaybookPermission";
import { asyncHandler } from "../utils";

export const policyRouter = Router();

// Read-only (see policy.service.ts) — gated on the same Playbooks module
// as the designer that consumes this list, not a separate Policies module.

/**
 * @openapi
 * /policies:
 *   get:
 *     summary: List approval policies
 *     description: Read-only — populates the Playbook Designer's "require approval via policy X" pickers.
 *     tags: [Policies]
 *     responses:
 *       200:
 *         description: Every policy defined for this tenant.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string }
 *                       name: { type: string }
 *                       timeoutDuration: { type: string, example: "24 hours" }
 *                       escalationAfter: { type: string, nullable: true, example: "12 hours" }
 *                       escalationChannel: { type: string, nullable: true, example: "#soc-escalations" }
 */
policyRouter.get("/", requirePlaybookPermission(ACTION_NAMES.VIEW), asyncHandler(policyController.listPolicies));
