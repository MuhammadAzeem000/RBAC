import "./utils/bigint";
import { env } from "./config/env";
import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import { actionRouter } from "./routes/action.routes";
import { auditLogRouter } from "./routes/auditLog.routes";
import { authRouter } from "./routes/auth.routes";
import { departmentRouter } from "./routes/department.routes";
import { connectEventBus } from "./events/eventBus.service";
import { errorHandler } from "./middlewares/errorHandler";
import { authenticate } from "./middlewares/authenticate";
import { moduleRouter } from "./routes/module.routes";
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

app.get("/", (_req: Request, res: Response) => {
    res.send("Hello Docker World!");
});

// Public: login/register/refresh are how a session gets created in the first place.
app.use("/api/auth", authRouter);

// Everything else requires a valid access token.
app.use("/api/users", authenticate, userRouter);
app.use("/api/departments", authenticate, departmentRouter);
app.use("/api/roles", authenticate, roleRouter);
app.use("/api/modules", authenticate, moduleRouter);
app.use("/api/actions", authenticate, actionRouter);
app.use("/api/permissions", authenticate, permissionRouter);
app.use("/api/audit-logs", authenticate, auditLogRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Fire-and-forget: connects in the background with its own retry loop, so a
// slow-starting or temporarily unreachable broker never delays the server
// from accepting requests.
void connectEventBus();