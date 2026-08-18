# Build context is the repo root (see docker-compose.yml), so all COPY paths
# below are relative to the repo root, not this file's directory.

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY backend/services/notification-service/package*.json ./
RUN npm ci

COPY backend/services/notification-service/tsconfig.json ./
COPY backend/services/notification-service/src ./src
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY backend/services/notification-service/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 4100

CMD ["node", "dist/server.js"]
