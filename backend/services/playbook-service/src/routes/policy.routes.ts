import { Router } from "express";
import * as policyController from "../controllers/policy.controller";
import { ACTION_NAMES } from "../constants/module";
import { requirePlaybookPermission } from "../middlewares/requirePlaybookPermission";
import { asyncHandler } from "../utils";

export const policyRouter = Router();

// Read-only (see policy.service.ts) — gated on the same Playbooks module
// as the designer that consumes this list, not a separate Policies module.
policyRouter.get("/", requirePlaybookPermission(ACTION_NAMES.VIEW), asyncHandler(policyController.listPolicies));
