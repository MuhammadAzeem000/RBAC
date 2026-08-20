# Build context is the repo root (see docker-compose.yml), so all COPY paths
# below are relative to the repo root, not this file's directory.

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Vite bakes VITE_* vars into the bundle at build time — this must be an ARG,
# not a runtime environment variable, since nothing reads it after this point.
ARG VITE_API_BASE_URL=http://localhost:4000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- Production stage: serve the static build with nginx ----
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
