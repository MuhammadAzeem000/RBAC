import { Router } from "express";
import * as taxiiServerController from "../controllers/taxiiServer.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireThreatIntelPermission } from "../middlewares/requireThreatIntelPermission";
import { asyncHandler } from "../utils";

export const taxiiServerRouter = Router();

const canView = requireThreatIntelPermission(ACTION_NAMES.VIEW);
const canCreate = requireThreatIntelPermission(ACTION_NAMES.CREATE);
const canUpdate = requireThreatIntelPermission(ACTION_NAMES.UPDATE);
const canDelete = requireThreatIntelPermission(ACTION_NAMES.DELETE);

/**
 * @openapi
 * /taxii-servers:
 *   get:
 *     summary: List configured TAXII 2.1 servers
 *     tags: [TAXII Servers]
 *     responses:
 *       200:
 *         description: Configured TAXII servers for this tenant. Credentials are never returned, only credentialConfigured.
 *   post:
 *     summary: Register a new TAXII 2.1 server
 *     tags: [TAXII Servers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, discoveryUrl]
 *             properties:
 *               name: { type: string }
 *               discoveryUrl: { type: string, description: The server's own /taxii2/ discovery endpoint. }
 *               authType: { type: string, enum: [none, basic, bearer] }
 *               credential: { type: object, additionalProperties: true, description: "{username, password} for basic, {token} for bearer." }
 *     responses:
 *       201:
 *         description: Server registered.
 */
taxiiServerRouter.get("/", canView, asyncHandler(taxiiServerController.listTaxiiServers));
taxiiServerRouter.post("/", canCreate, asyncHandler(taxiiServerController.createTaxiiServer));

/**
 * @openapi
 * /taxii-servers/{id}:
 *   put:
 *     summary: Update a TAXII server's config or credentials
 *     tags: [TAXII Servers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Server updated.
 *   delete:
 *     summary: Remove a TAXII server (and its collections)
 *     tags: [TAXII Servers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Server removed.
 */
taxiiServerRouter.put("/:id", canUpdate, asyncHandler(taxiiServerController.updateTaxiiServer));
taxiiServerRouter.delete("/:id", canDelete, asyncHandler(taxiiServerController.deleteTaxiiServer));
