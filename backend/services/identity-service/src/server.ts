import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { actionRouter } from "./routes/action.routes";
import { authRouter } from "./routes/auth.routes";
import { departmentRouter } from "./routes/department.routes";
import { tenantRouter } from "./routes/tenant.routes";
import { connectEventBus } from "./events/eventBus.service";
import { errorHandler } from "./middlewares/errorHandler";
import { authenticate } from "./middlewares/authenticate";
import { tenantContext } from "./middlewares/tenantContext";
import { MODULE_NAMES } from "./constants/rbac";
import { moduleRouter } from "./routes/module.routes";
import { ensureModuleSeeded, ensureTenantsModuleSeeded } from "./services/moduleSeed.service";
import { startOutboxPublisher } from "./services/outboxPublisher.service";
import { notFound } from "./middlewares/notFound";
import { permissionRouter } from "./routes/permission.routes";
import { roleRouter } from "./routes/role.routes";
import { userRouter } from "./routes/user.routes";

const app = express();
const PORT = env.PORT;

app.use(
  cors({
    origin: env.CORS_ORIGINS,
  }),
);
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// Public: login/register/refresh are how a session gets created in the first place.
app.use("/api/auth", authRouter);

// Everything else requires a valid access token. /users and /departments
// also get tenantContext — they (and the role/department assignments nested
// under userRouter) are tenant-scoped models; roles/modules/actions/
// permissions/tenants are global platform taxonomy and don't need it (see
// the Role model comment in prisma/schema.prisma).
app.use("/api/users", authenticate, tenantContext, userRouter);
app.use("/api/departments", authenticate, tenantContext, departmentRouter);
app.use("/api/roles", authenticate, roleRouter);
app.use("/api/modules", authenticate, moduleRouter);
app.use("/api/actions", authenticate, actionRouter);
app.use("/api/permissions", authenticate, permissionRouter);
app.use("/api/tenants", authenticate, tenantRouter);
// Audit logs are no longer served here — audit-service is now the sole
// authoritative store (see backend/services/audit-service), reached via the
// gateway's own "/api/audit-logs" route.

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Fire-and-forget: connects in the background with its own retry loop, so a
// slow-starting or temporarily unreachable broker never delays the server
// from accepting requests.
void connectEventBus();

// Backfills the Incidents module/permissions for systems that were already
// bootstrapped before incident-service existed — safe to run on every boot,
// idempotent (find-or-create), and cheap. Does not block request handling.
void ensureModuleSeeded(MODULE_NAMES.INCIDENTS, 8);

// Same backfill for the Connectors module (Phase 3) — auto-granted to
// Administrator like Incidents, since connectors are tenant-scoped
// resources, unlike Tenants below.
void ensureModuleSeeded(MODULE_NAMES.CONNECTORS, 10);

// Backfills the Tenants module/permissions the same way, but deliberately
// does NOT grant them to "Administrator" (see MODULE_NAMES.TENANTS) — nobody
// can manage tenants until a real platform operator is granted this
// explicitly through the Roles/Permissions UI.
void ensureTenantsModuleSeeded();

// Delivers this service's transactional-outbox rows to audit-service — see
// services/outbox.service.ts (the write side, used inside business
// transactions) and services/outboxPublisher.service.ts (this, the delivery
// side). Independent of connectEventBus() above; audit events are not
// domain events.
startOutboxPublisher();
