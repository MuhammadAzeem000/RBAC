# Build context is the repo root (see docker-compose.yml), so all COPY paths
# below are relative to the repo root, not this file's directory.

FROM node:20-alpine AS build
WORKDIR /app

COPY backend/api-gateway/package*.json ./
RUN npm ci

COPY backend/api-gateway/tsconfig.json ./
COPY backend/api-gateway/src ./src
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY backend/api-gateway/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8000
CMD ["node", "dist/server.js"]
