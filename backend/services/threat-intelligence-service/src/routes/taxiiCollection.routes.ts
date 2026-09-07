import { Router } from "express";
import * as taxiiCollectionController from "../controllers/taxiiCollection.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireThreatIntelPermission } from "../middlewares/requireThreatIntelPermission";
import { asyncHandler } from "../utils";

export const taxiiCollectionRouter = Router();

const canView = requireThreatIntelPermission(ACTION_NAMES.VIEW);
const canCreate = requireThreatIntelPermission(ACTION_NAMES.CREATE);
const canUpdate = requireThreatIntelPermission(ACTION_NAMES.UPDATE);
const canDelete = requireThreatIntelPermission(ACTION_NAMES.DELETE);

/**
 * @openapi
 * /taxii-servers/{serverId}/collections/discover:
 *   get:
 *     summary: List the collections a configured TAXII server actually advertises
 *     description: Calls out to the TAXII server live (GET {apiRoot}/collections/) — used to populate the "add collection" picker.
 *     tags: [TAXII Collections]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The collections advertised by this server.
 */
taxiiCollectionRouter.get(
  "/taxii-servers/:serverId/collections/discover",
  canView,
  asyncHandler(taxiiCollectionController.discoverCollections),
);

/**
 * @openapi
 * /taxii-servers/{serverId}/collections:
 *   get:
 *     summary: List collections configured for polling under a TAXII server
 *     tags: [TAXII Collections]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Configured collections and their poll cursor state.
 *   post:
 *     summary: Configure a new collection for scheduled polling
 *     tags: [TAXII Collections]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collectionId]
 *             properties:
 *               collectionId: { type: string, description: The TAXII collection's own id (a UUID per the spec). }
 *               title: { type: string }
 *               pollIntervalSeconds: { type: integer, default: 900 }
 *     responses:
 *       201:
 *         description: Collection configured.
 */
taxiiCollectionRouter.get(
  "/taxii-servers/:serverId/collections",
  canView,
  asyncHandler(taxiiCollectionController.listTaxiiCollections),
);
taxiiCollectionRouter.post(
  "/taxii-servers/:serverId/collections",
  canCreate,
  asyncHandler(taxiiCollectionController.createTaxiiCollection),
);

/**
 * @openapi
 * /taxii-collections/{id}:
 *   put:
 *     summary: Update a collection's poll interval or enabled status
 *     tags: [TAXII Collections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Collection updated.
 *   delete:
 *     summary: Remove a collection from scheduled polling
 *     tags: [TAXII Collections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Collection removed.
 */
taxiiCollectionRouter.put("/taxii-collections/:id", canUpdate, asyncHandler(taxiiCollectionController.updateTaxiiCollection));
taxiiCollectionRouter.delete(
  "/taxii-collections/:id",
  canDelete,
  asyncHandler(taxiiCollectionController.deleteTaxiiCollection),
);

/**
 * @openapi
 * /taxii-collections/{id}/poll:
 *   post:
 *     summary: Trigger an immediate poll of this collection
 *     description: Runs the same poll logic as the scheduled poller, synchronously, instead of waiting for the next tick.
 *     tags: [TAXII Collections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Poll completed (success or failure reported via lastPollStatus/lastPollError).
 *       404:
 *         description: Collection not found.
 */
taxiiCollectionRouter.post(
  "/taxii-collections/:id/poll",
  canUpdate,
  asyncHandler(taxiiCollectionController.triggerPoll),
);

/**
 * @openapi
 * /taxii-collections/{id}/status:
 *   get:
 *     summary: Get a collection's last poll status and ingested object count
 *     tags: [TAXII Collections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Poll status, cursor state, and ingested object count.
 *       404:
 *         description: Collection not found.
 */
taxiiCollectionRouter.get(
  "/taxii-collections/:id/status",
  canView,
  asyncHandler(taxiiCollectionController.getTaxiiCollectionStatus),
);
