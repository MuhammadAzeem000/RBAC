# Build context is the repo root (see docker-compose.yml), so all COPY paths
# below are relative to the repo root, not this file's directory.

# ---- Build stage: compile TypeScript + generate the Prisma client ----
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

# @responderx/shared is a "file:../../shared" dependency (see package.json)
# resolved relative to /app, so it must live at /shared — same depth as
# docker-compose.dev.yml's bind mount, just built instead of live-mounted.
# It needs its own install+build (its compiled dist/ isn't committed to git)
# before this service's own `npm ci` can resolve it.
COPY backend/shared /shared
RUN npm --prefix /shared ci && npm --prefix /shared run build

COPY backend/services/incident-service/package*.json ./
RUN npm ci

COPY backend/services/incident-service/tsconfig.json backend/services/incident-service/prisma.config.ts ./
COPY backend/services/incident-service/prisma ./prisma
COPY backend/services/incident-service/src ./src

# prisma.config.ts loads src/config/env.ts, which strictly validates every
# runtime env var (JWT secret, DB credentials) via zod — none of which exist
# yet at build time (they're only injected at container runtime). `prisma
# generate` never opens a DB connection or reads these values for anything
# real, so placeholders here just satisfy that validation; they don't carry
# over to the production stage below.
ENV DB_HOST=build DB_PORT=5432 DB_USER=build DB_PASSWORD=build DB_NAME=build \
    JWT_ACCESS_SECRET=build_time_placeholder_not_used_at_runtime_000000

RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /shared /shared
COPY backend/services/incident-service/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
# prisma.config.ts imports ./src/config/env at runtime (Prisma's config
# loader transpiles it on the fly), so the source tree must ship alongside dist.
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY backend/services/incident-service/prisma.config.ts ./

EXPOSE 4200

# incident-service owns its own database (incident_db) and its own
# migrations — unlike auth, this is a genuinely separate service with a
# genuinely separate schema, so it applies its own pending migrations on boot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
