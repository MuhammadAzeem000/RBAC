import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/authenticate";
import { asyncHandler } from "../utils";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(authController.register));
authRouter.post("/login", asyncHandler(authController.login));
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", authenticate, asyncHandler(authController.logout));
authRouter.get("/me", authenticate, asyncHandler(authController.me));
authRouter.get("/me/modules", authenticate, asyncHandler(authController.myModules));
