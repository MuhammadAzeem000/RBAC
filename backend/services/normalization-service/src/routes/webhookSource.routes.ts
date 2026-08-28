import { Router } from "express";
import * as webhookSourceController from "../controllers/webhookSource.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireConnectorPermission } from "../middlewares/requireConnectorPermission";
import { asyncHandler } from "../utils";

export const webhookSourceRouter = Router();

webhookSourceRouter.post(
  "/",
  requireConnectorPermission(ACTION_NAMES.CREATE),
  asyncHandler(webhookSourceController.createWebhookSourceRoute),
);
webhookSourceRouter.get(
  "/",
  requireConnectorPermission(ACTION_NAMES.VIEW),
  asyncHandler(webhookSourceController.listWebhookSourcesRoute),
);
