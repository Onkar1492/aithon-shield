# Aithon Shield — Self-Hosted Container Image
# P6-I3: Air-gap / self-hosted packaging
#
# Build:   docker build -t aithon-shield .
# Run:     docker compose up -d
# Air-gap: save with  docker save aithon-shield | gzip > aithon-shield.tar.gz
#          load with  docker load < aithon-shield.tar.gz

FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ── dependency layer (cached unless package*.json changes) ──────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

# ── build layer ─────────────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
COPY . .
RUN npm run build

# ── runtime layer ───────────────────────────────────────────────────
FROM base AS runtime

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/shared ./shared

# Non-root user for security
RUN groupadd -r aithon && useradd -r -g aithon -m aithon && \
    chown -R aithon:aithon /app
USER aithon

EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5001/api/health/ready || exit 1

CMD ["node", "dist/index.js"]
