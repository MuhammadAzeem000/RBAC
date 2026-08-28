# Build context is the repo root (see docker-compose.yml), so all COPY paths
# below are relative to the repo root, not this file's directory.
#
# Debian-based (node:20-slim), NOT node:20-alpine like every other service's
# Dockerfile in this repo — @temporalio/core-bridge (src/temporal/) ships a
# native binding built against glibc, and Alpine's musl libc can't load it
# (confirmed in incident-service, this subsystem's original home, before this
# split: neither running unmodified nor with the "gcompat" compatibility
# shim, which is missing symbols like gnu_get_libc_version the binding
# actually needs — this isn't a "just add a package" fix on Alpine).

# ---- Build stage: compile TypeScript + generate the Prisma client ----
FROM node:20-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# @responderx/shared is a "file:../../shared" dependency (see package.json)
# resolved relative to /app, so it must live at /shared — same depth as
# docker-compose.dev.yml's bind mount, just built instead of live-mounted.
# It needs its own install+build (its compiled dist/ isn't committed to git)
# before this service's own `npm ci` can resolve it.
COPY backend/shared /shared
RUN npm --prefix /shared ci && npm --prefix /shared run build

COPY backend/services/playbook-service/package*.json ./
RUN npm ci

COPY backend/services/playbook-service/tsconfig.json backend/services/playbook-service/prisma.config.ts ./
COPY backend/services/playbook-service/prisma ./prisma
COPY backend/services/playbook-service/src ./src

# prisma.config.ts loads src/config/env.ts, which strictly validates every
# runtime env var (JWT secret, DB credentials, service tokens) via zod — none
# of which exist yet at build time (they're only injected at container
# runtime). `prisma generate` never opens a DB connection or reads these
# values for anything real, so placeholders here just satisfy that
# validation; they don't carry over to the production stage below.
ENV DB_HOST=build DB_PORT=5432 DB_USER=build DB_PASSWORD=build DB_NAME=build \
    JWT_ACCESS_SECRET=build_time_placeholder_not_used_at_runtime_000000 \
    INTEGRATION_SERVICE_TOKEN=build_time_placeholder_000000 \
    INCIDENT_SERVICE_TOKEN=build_time_placeholder_000000 \
    PLAYBOOK_SERVICE_TOKEN=build_time_placeholder_000000

RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:20-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /shared /shared
COPY backend/services/playbook-service/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
# prisma.config.ts imports ./src/config/env at runtime (Prisma's config
# loader transpiles it on the fly), so the source tree must ship alongside dist.
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY backend/services/playbook-service/prisma.config.ts ./

EXPOSE 4600

# playbook-service owns its own database (playbook_db) and its own migrations.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
