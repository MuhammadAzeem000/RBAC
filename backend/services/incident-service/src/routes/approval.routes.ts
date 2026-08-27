import { Router } from "express";
import * as approvalController from "../controllers/approval.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireApprovalPermission } from "../middlewares/requireApprovalPermission";
import { asyncHandler } from "../utils";

export const approvalRouter = Router();

const canView = requireApprovalPermission(ACTION_NAMES.VIEW);
const canUpdate = requireApprovalPermission(ACTION_NAMES.UPDATE);

approvalRouter.get("/", canView, asyncHandler(approvalController.listApprovals));
approvalRouter.post("/:id/decision", canUpdate, asyncHandler(approvalController.decideApproval));
