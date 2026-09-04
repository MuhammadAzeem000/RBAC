import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

// Dev-only API documentation (mounted at /api-docs by server.ts, gated on
// NODE_ENV !== "production") — extracted from @openapi JSDoc blocks kept
// directly above each route registration in src/routes/*.ts, so the docs
// live next to the path/method they describe instead of drifting in a
// separate file.
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "ResponderX — Identity Service",
      version: "1.0.0",
      description:
        "Authentication, tenants, users, RBAC (roles/permissions/modules/actions), and departments. /api/auth is public (login/register/refresh); every other route requires a valid access token.",
    },
    servers: [{ url: "/api", description: "Behind the API gateway" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "User access token issued by POST /api/auth/login.",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.ts", "./src/server.ts"],
});

export const swaggerUiOptions = { explorer: true };
export const isSwaggerEnabled = env.NODE_ENV !== "production";
