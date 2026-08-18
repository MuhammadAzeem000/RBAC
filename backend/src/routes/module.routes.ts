import { Router } from "express";
import * as moduleController from "../controllers/module.controller";
import { asyncHandler } from "../utils";

export const moduleRouter = Router();

moduleRouter.get("/", asyncHandler(moduleController.getModules));
moduleRouter.get("/:id", asyncHandler(moduleController.getModuleById));
moduleRouter.post("/", asyncHandler(moduleController.createModule));
moduleRouter.put("/:id", asyncHandler(moduleController.updateModule));
moduleRouter.delete("/:id", asyncHandler(moduleController.deleteModule));
