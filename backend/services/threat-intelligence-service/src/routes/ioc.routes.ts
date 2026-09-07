import { Router } from "express";
import * as iocController from "../controllers/ioc.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireThreatIntelPermission } from "../middlewares/requireThreatIntelPermission";
import { asyncHandler } from "../utils";

// Human-facing router — server.ts mounts `authenticate` + `tenantContext`
// ahead of this router. GET /iocs/lookup is ALSO registered directly in
// server.ts, before this router, gated by requireServiceToken instead — see
// the comment there. Both routes share the same controller function.
export const iocRouter = Router();

const canView = requireThreatIntelPermission(ACTION_NAMES.VIEW);

/**
 * @openapi
 * /iocs/lookup:
 *   get:
 *     summary: Look up a single IOC value
 *     description: The primary lookup a future playbook connector action or normalization-service enrichment step would call.
 *     tags: [IOCs]
 *     parameters:
 *       - in: query
 *         name: value
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *         description: e.g. ipv4-addr, domain-name, url, file:hashes.'SHA-256'.
 *     responses:
 *       200:
 *         description: found=false when no match exists; otherwise the matched indicator's details.
 *       400:
 *         description: Missing value.
 */
iocRouter.get("/lookup", canView, asyncHandler(iocController.lookupIoc));

/**
 * @openapi
 * /iocs:
 *   get:
 *     summary: Search IOCs
 *     tags: [IOCs]
 *     parameters:
 *       - in: query
 *         name: value
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: stixType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching indicator objects (most recently ingested first).
 */
iocRouter.get("/", canView, asyncHandler(iocController.searchIocs));
