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
      title: "ResponderX — Alert Ingestion Service",
      version: "1.0.0",
      description:
        "Validates, deduplicates, and canonically normalizes inbound alerts, then hands off case creation to incident-service via an event-driven saga. Every endpoint is tenant-scoped by the caller's JWT except the machine-to-machine /system route, which is scoped by the tenantId in its body instead.",
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
          description: "Shared secret used for machine-to-machine calls between services (normalization-service -> here).",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.ts", "./src/server.ts"],
});

export const swaggerUiOptions = { explorer: true };
export const isSwaggerEnabled = env.NODE_ENV !== "production";
