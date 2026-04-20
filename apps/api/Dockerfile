# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# apps/api — multi-stage build for the Express + TypeScript gateway.
# Context: repo root (needs pnpm workspace files + packages/shared).
# Build from repo root:   docker build -f apps/api/Dockerfile -t bullfin-api .
# -----------------------------------------------------------------------------

# ---- Stage 1: pruned monorepo ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
# Install all workspace deps (prod + dev) so TS can build.
RUN pnpm install --frozen-lockfile=false

# ---- Stage 2: build ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @bullfin/api build

# ---- Stage 3: prod deps only ----
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --prod --frozen-lockfile=false

# ---- Stage 4: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Non-root user
RUN addgroup -S bullfin && adduser -S bullfin -G bullfin
USER bullfin

COPY --chown=bullfin:bullfin --from=prod-deps /app/node_modules ./node_modules
COPY --chown=bullfin:bullfin --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=bullfin:bullfin --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --chown=bullfin:bullfin --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=bullfin:bullfin --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --chown=bullfin:bullfin --from=build /app/packages/shared ./packages/shared

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
