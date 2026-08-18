import { Router } from "express";
import * as actionController from "../controllers/action.controller";
import { asyncHandler } from "../utils";

export const actionRouter = Router();

actionRouter.get("/", asyncHandler(actionController.getActions));
actionRouter.get("/:id", asyncHandler(actionController.getActionById));
actionRouter.post("/", asyncHandler(actionController.createAction));
actionRouter.put("/:id", asyncHandler(actionController.updateAction));
actionRouter.delete("/:id", asyncHandler(actionController.deleteAction));
