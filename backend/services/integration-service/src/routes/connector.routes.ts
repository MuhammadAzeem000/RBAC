import { Router } from "express";
import * as connectorController from "../controllers/connector.controller";
import { ACTION_NAMES } from "../constants/module";
import { requireConnectorPermission } from "../middlewares/requireConnectorPermission";
import { asyncHandler } from "../utils";

// Human-facing, JWT-authenticated only — server.ts mounts `authenticate` +
// `tenantContext` ahead of this router. The machine-to-machine action route
// (POST /:key/actions/:action) is DELIBERATELY NOT here: it needs
// requireServiceToken instead of authenticate (see requireServiceToken.ts),
// and mounting it under this router would put it behind `authenticate` too,
// which defeats the whole point since Temporal Activities have no user JWT
// to send. It's registered directly in server.ts instead, before this
// router, so Express matches it first and `authenticate` never runs for it.
export const connectorRouter = Router();

const canView = requireConnectorPermission(ACTION_NAMES.VIEW);
const canUpdate = requireConnectorPermission(ACTION_NAMES.UPDATE);

connectorRouter.get("/", canView, asyncHandler(connectorController.listConnectors));
connectorRouter.put("/:key/credentials", canUpdate, asyncHandler(connectorController.setCredentials));
connectorRouter.post("/:key/test", canUpdate, asyncHandler(connectorController.testConnector));
