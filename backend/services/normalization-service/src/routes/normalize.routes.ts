import { Router } from "express";
import * as normalizeController from "../controllers/normalize.controller";
import { asyncHandler } from "../utils";

export const normalizeRouter = Router();

/**
 * @openapi
 * /normalize/{vendor}/{token}:
 *   post:
 *     summary: Receive a vendor SIEM/EDR webhook
 *     description: >
 *       PUBLIC — deliberately not behind `authenticate`; a vendor SIEM/EDR sends its own webhook auth (or none),
 *       never a ResponderX JWT. The URL token IS the credential: it resolves the tenant and must belong to a
 *       webhook source already created for `vendor` via POST /webhook-sources. The body shape is vendor-specific
 *       (not a single fixed schema) — see src/parsers/{vendor}.parser.ts for the exact fields each vendor's parser
 *       reads: splunk.parser.ts expects Splunk's Webhook alert-action payload (`sid`, `result.*`); sentinel.parser.ts
 *       expects Azure Monitor's Common Alert Schema (`data.essentials`, `data.alertContext.properties`);
 *       crowdstrike.parser.ts expects a Falcon Detection Summary Event (`detection_id`, `device`, `behaviors[]`);
 *       generic.parser.ts accepts a payload already close to the canonical alert shape
 *       (`source`, `externalId`, `severity`, `timestamp`, `entities[]`, `rawRef`). On success, the parsed alert is
 *       handed off to alert-ingestion-service's machine-to-machine POST /alerts/system.
 *     tags: [Normalize]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: vendor
 *         required: true
 *         schema: { type: string, enum: [splunk, sentinel, crowdstrike, generic] }
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: The webhook source's own token, from POST /webhook-sources's receivePath.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Vendor-specific payload shape — see the endpoint description above for what each vendor's parser reads.
 *             additionalProperties: true
 *     responses:
 *       202:
 *         description: Parsed and handed off to alert-ingestion-service.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: accepted }
 *       400:
 *         description: >
 *           Either the token's configured vendor doesn't match the {vendor} path segment, the {vendor} segment isn't
 *           a known parser, or the payload failed to parse for that vendor's expected shape.
 *       404:
 *         description: Unknown webhook token.
 */
// No auth middleware — see normalize.controller.ts's receiveWebhook.
normalizeRouter.post("/:vendor/:token", asyncHandler(normalizeController.receiveWebhook));
