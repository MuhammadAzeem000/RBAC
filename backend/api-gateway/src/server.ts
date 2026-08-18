import express, { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "./env";

const app = express();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// identity-service is the only backend right now, so this is a single
// pass-through — kept as the frontend's one entry point in case another
// service (incident-service, integration-service, ...) joins behind the
// gateway later. Express strips the app.use() mount path before the proxy
// ever sees the request, and http-proxy-middleware v3 doesn't restore it
// automatically, so pathRewrite adds "/api" back on the way out.
app.use(
  "/api",
  createProxyMiddleware({
    target: env.IDENTITY_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/" },
  }),
);

app.listen(env.PORT, () => {
  console.log(`api-gateway listening on port ${env.PORT}`);
  console.log(`  /api/* -> ${env.IDENTITY_SERVICE_URL}`);
});
