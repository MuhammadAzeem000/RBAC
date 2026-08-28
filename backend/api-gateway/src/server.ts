import express, { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "./env";

const app = express();

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Express strips the app.use() mount path before the proxy ever sees the
// request, and http-proxy-middleware v3 doesn't restore it automatically,
// so pathRewrite adds the prefix back on the way out. Order matters: the
// more specific prefixes ("/api/v1", "/api/audit-logs" — audit-service is
// the single authoritative audit-log store now, replacing identity-service's
// old route of the same path) must be registered before the catch-all
// "/api" one (identity-service) below, or they'd never be reached.
// Alert ingestion moved into its own service (Phase 5.1's decomposition
// slice 1) — its routes share the "/api/v1" prefix with incident-service's,
// so this more specific mount must be registered first (see the comment
// above about prefix ordering).
app.use(
  "/api/v1/alerts",
  createProxyMiddleware({
    target: env.ALERT_INGESTION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/v1/alerts/" },
  }),
);

// Playbook catalog/runs and approvals moved into their own service (Phase
// 5.2's decomposition slice 2) — same prefix-ordering requirement as the
// alerts carve-out above.
app.use(
  "/api/v1/playbook-catalog",
  createProxyMiddleware({
    target: env.PLAYBOOK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/v1/playbook-catalog/" },
  }),
);
app.use(
  "/api/v1/playbook-runs",
  createProxyMiddleware({
    target: env.PLAYBOOK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/v1/playbook-runs/" },
  }),
);
app.use(
  "/api/v1/approvals",
  createProxyMiddleware({
    target: env.PLAYBOOK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/v1/approvals/" },
  }),
);

app.use(
  "/api/v1",
  createProxyMiddleware({
    target: env.INCIDENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/v1/" },
  }),
);

app.use(
  "/api/audit-logs",
  createProxyMiddleware({
    target: env.AUDIT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/audit-logs/" },
  }),
);

app.use(
  "/api/connectors",
  createProxyMiddleware({
    target: env.INTEGRATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/connectors/" },
  }),
);

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
  console.log(`  /api/v1/alerts/*           -> ${env.ALERT_INGESTION_SERVICE_URL}`);
  console.log(`  /api/v1/playbook-catalog/* -> ${env.PLAYBOOK_SERVICE_URL}`);
  console.log(`  /api/v1/playbook-runs/*    -> ${env.PLAYBOOK_SERVICE_URL}`);
  console.log(`  /api/v1/approvals/*        -> ${env.PLAYBOOK_SERVICE_URL}`);
  console.log(`  /api/v1/*                  -> ${env.INCIDENT_SERVICE_URL}`);
  console.log(`  /api/audit-logs* -> ${env.AUDIT_SERVICE_URL}`);
  console.log(`  /api/connectors* -> ${env.INTEGRATION_SERVICE_URL}`);
  console.log(`  /api/*           -> ${env.IDENTITY_SERVICE_URL}`);
});
