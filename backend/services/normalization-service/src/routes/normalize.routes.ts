import { Router } from "express";
import * as normalizeController from "../controllers/normalize.controller";
import { asyncHandler } from "../utils";

export const normalizeRouter = Router();

// No auth middleware — see normalize.controller.ts's receiveWebhook.
normalizeRouter.post("/:vendor/:token", asyncHandler(normalizeController.receiveWebhook));
