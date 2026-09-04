import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

// Dev-only API documentation (mounted at /api-docs by server.ts, gated on
// NODE_ENV !== "production") — extracted from @openapi JSDoc blocks kept
// directly above each route registration in src/routes/*.ts and the
// service-token route in server.ts itself, so the docs live next to the
// path/method they describe instead of drifting in a separate file.
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "ResponderX — Normalization Service",
      version: "1.0.0",
      description:
        "Parses vendor SIEM/EDR webhook payloads (Splunk, Sentinel, CrowdStrike, generic) into the canonical alert shape and hands off to alert-ingestion-service. /normalize/* is public (vendor webhook auth, not a ResponderX JWT); /webhook-sources is the tenant-scoped management API for webhook tokens.",
    },
    servers: [{ url: "/api/v1", description: "Behind the API gateway" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "User access token issued by identity-service's POST /api/auth/login.",
        },
        serviceToken: {
          type: "apiKey",
          in: "header",
          name: "X-Service-Token",
          description: "Shared secret used for machine-to-machine calls between services.",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.ts", "./src/server.ts"],
});

export const swaggerUiOptions = { explorer: true };
export const isSwaggerEnabled = env.NODE_ENV !== "production";
