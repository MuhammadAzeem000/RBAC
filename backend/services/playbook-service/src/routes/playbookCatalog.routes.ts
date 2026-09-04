import { Router } from "express";
import * as playbookRunController from "../controllers/playbookRun.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireIncidentPermission } from "../middlewares/requireIncidentPermission";
import { asyncHandler } from "../utils";

export const playbookCatalogRouter = Router();

/**
 * @openapi
 * /playbook-catalog:
 *   get:
 *     summary: List the runnable playbook catalog
 *     description: One entry per playbook's latest published version — the picker used to start a run against an incident.
 *     tags: [Playbook Catalog]
 *     responses:
 *       200:
 *         description: Every playbook with at least one published version.
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
 *                       description: { type: string, nullable: true }
 *                       version: { type: string }
 *                       requiresApproval: { type: boolean }
 *                       startPolicyKey: { type: string, nullable: true }
 */
playbookCatalogRouter.get(
  "/",
  requireIncidentPermission(ACTION_NAMES.VIEW),
  asyncHandler(playbookRunController.listPlaybookCatalog),
);
