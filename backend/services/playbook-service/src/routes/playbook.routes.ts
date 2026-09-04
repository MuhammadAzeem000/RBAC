import { Router } from "express";
import * as playbookController from "../controllers/playbook.controller";
import { ACTION_NAMES } from "../constants/module";
import { requirePlaybookPermission } from "../middlewares/requirePlaybookPermission";
import { asyncHandler } from "../utils";

export const playbookRouter = Router();

const canView = requirePlaybookPermission(ACTION_NAMES.VIEW);
const canCreate = requirePlaybookPermission(ACTION_NAMES.CREATE);
const canUpdate = requirePlaybookPermission(ACTION_NAMES.UPDATE);

/**
 * @openapi
 * components:
 *   schemas:
 *     PlaybookStep:
 *       type: object
 *       required: [key, name]
 *       properties:
 *         key: { type: string, description: "Unique within the version — also the graph node id edges reference." }
 *         name: { type: string }
 *         connector: { type: string, description: "Leave unset to simulate this step." }
 *         action: { type: string }
 *         policyKey: { type: string, description: "Pauses for human approval under this policy before the step runs." }
 *         config: { type: object, additionalProperties: true }
 *         position: { type: object, properties: { x: { type: number }, y: { type: number } }, description: "Canvas layout only — never read by execution." }
 *     PlaybookEdge:
 *       type: object
 *       required: [id, source, target]
 *       properties:
 *         id: { type: string }
 *         source: { type: string, description: "Source step key." }
 *         target: { type: string, description: "Target step key." }
 *         condition:
 *           type: object
 *           description: "Omitted means this edge always fires once its source step executes — this is what makes an unconditioned parallel fan-out fall out of the same mechanism as conditional branching."
 *           required: [field, operator]
 *           properties:
 *             field: { type: string, description: "Dot-path into the run's accumulated step-output context, e.g. lookup-ip.stats.malicious." }
 *             operator: { type: string, enum: [eq, neq, gt, gte, lt, lte, contains, exists] }
 *             value: {}
 *     SavePlaybookInput:
 *       type: object
 *       required: [name, steps]
 *       properties:
 *         name: { type: string }
 *         description: { type: string }
 *         startPolicyKey: { type: string, description: "Gates the whole run before its first step. Omit for no gate." }
 *         steps:
 *           type: array
 *           items: { $ref: '#/components/schemas/PlaybookStep' }
 *         edges:
 *           type: array
 *           items: { $ref: '#/components/schemas/PlaybookEdge' }
 *           description: "Empty means a linear chain over `steps` in order — see PlaybookEdge."
 *
 * /playbooks:
 *   get:
 *     summary: List playbooks (Playbook Designer)
 *     tags: [Playbooks]
 *     responses:
 *       200:
 *         description: One entry per playbook's latest version, with step/branch counts for the list page.
 *   post:
 *     summary: Create a playbook (first version, "1.0")
 *     description: >
 *       If `edges` is non-empty, the graph is validated: every edge must reference a real step key, the graph must
 *       be acyclic, have exactly one start step (no incoming edges), and every step must be reachable from it.
 *     tags: [Playbooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SavePlaybookInput'
 *               - type: object
 *                 required: [key]
 *                 properties:
 *                   key: { type: string, description: "Lowercase, dash-separated. Immutable once created." }
 *     responses:
 *       201:
 *         description: The created playbook (version 1.0).
 *       400:
 *         description: Validation error, or an invalid graph (cycle, unreachable step, wrong start-step count, unknown edge reference).
 *       409:
 *         description: A playbook with this key already exists for this tenant.
 */
playbookRouter.get("/", canView, asyncHandler(playbookController.listPlaybooks));
playbookRouter.post("/", canCreate, asyncHandler(playbookController.createPlaybook));

/**
 * @openapi
 * /playbooks/{key}:
 *   get:
 *     summary: Get a playbook's latest version, plus version history
 *     tags: [Playbooks]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The playbook's current steps/edges and its published version history.
 *       404:
 *         description: Playbook not found.
 *   put:
 *     summary: Publish a new version of an existing playbook
 *     description: >
 *       A version is immutable once created — this always creates a new PlaybookVersion row (computed as the next
 *       sequential integer, e.g. "2.0") rather than mutating the existing one. Runs already in flight stay pinned
 *       to the version they started with.
 *     tags: [Playbooks]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SavePlaybookInput' }
 *     responses:
 *       200:
 *         description: The playbook with the newly published version now current.
 *       400:
 *         description: Validation error, or an invalid graph.
 *       404:
 *         description: Playbook not found.
 */
playbookRouter.get("/:key", canView, asyncHandler(playbookController.getPlaybook));
playbookRouter.put("/:key", canUpdate, asyncHandler(playbookController.publishPlaybookVersion));
