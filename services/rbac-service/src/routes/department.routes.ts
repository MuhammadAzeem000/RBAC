import { Router } from "express";
import * as departmentController from "../controllers/department.controller";
import { ACTION_NAMES, MODULE_NAMES } from "../constants/rbac";
import { requireModulePermission } from "../middlewares/requireModulePermission";
import { asyncHandler } from "../utils";

export const departmentRouter = Router();

const canView = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.VIEW);
const canCreate = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.CREATE);
const canUpdate = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.UPDATE);
const canDelete = requireModulePermission(MODULE_NAMES.DEPARTMENTS, ACTION_NAMES.DELETE);

departmentRouter.get("/", canView, asyncHandler(departmentController.getDepartments));
departmentRouter.get("/:id", canView, asyncHandler(departmentController.getDepartmentById));
departmentRouter.post("/", canCreate, asyncHandler(departmentController.createDepartment));
departmentRouter.put("/:id", canUpdate, asyncHandler(departmentController.updateDepartment));
departmentRouter.delete("/:id", canDelete, asyncHandler(departmentController.deleteDepartment));
