import { Router } from "express";
import * as departmentController from "../controllers/department.controller";
import { asyncHandler } from "../utils";

export const departmentRouter = Router();

departmentRouter.get("/", asyncHandler(departmentController.getDepartments));
departmentRouter.get("/:id", asyncHandler(departmentController.getDepartmentById));
departmentRouter.post("/", asyncHandler(departmentController.createDepartment));
departmentRouter.put("/:id", asyncHandler(departmentController.updateDepartment));
departmentRouter.delete("/:id", asyncHandler(departmentController.deleteDepartment));
