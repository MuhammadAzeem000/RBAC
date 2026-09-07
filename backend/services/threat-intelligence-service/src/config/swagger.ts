import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

// Dev-only API documentation (mounted at /api-docs by server.ts, gated on
// NODE_ENV !== "production") — extracted from @openapi JSDoc blocks kept
// directly above each route registration in src/routes/*.ts.
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "ResponderX — Threat Intelligence Service",
      version: "1.0.0",
      description:
        "STIX/TAXII 2.1 feed ingestion, a STIX-inspired IOC/object store, and a lookup API for future playbook/enrichment consumers.",
    },
    servers: [{ url: "/api/v1/threat-intel", description: "Behind the API gateway" }],
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
