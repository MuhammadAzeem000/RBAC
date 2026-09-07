import { Router } from "express";
import * as stixObjectController from "../controllers/stixObject.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireThreatIntelPermission } from "../middlewares/requireThreatIntelPermission";
import { asyncHandler } from "../utils";

export const stixObjectRouter = Router();

const canView = requireThreatIntelPermission(ACTION_NAMES.VIEW);

/**
 * @openapi
 * /stix-objects:
 *   get:
 *     summary: Browse STIX objects (any type, not just indicators)
 *     tags: [STIX Objects]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *         description: indicator | malware | threat-actor | attack-pattern | relationship | identity
 *       - in: query
 *         name: label
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching STIX objects (most recently ingested first).
 */
stixObjectRouter.get("/", canView, asyncHandler(stixObjectController.listStixObjects));

/**
 * @openapi
 * /stix-objects/{stixId}:
 *   get:
 *     summary: Get one STIX object by its STIX id
 *     tags: [STIX Objects]
 *     parameters:
 *       - in: path
 *         name: stixId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The full stored STIX object (raw + extracted fields).
 *       404:
 *         description: Not found.
 */
stixObjectRouter.get("/:stixId", canView, asyncHandler(stixObjectController.getStixObject));
