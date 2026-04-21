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
# Build shared first — its compiled dist/ is what the API's tsconfig.build
# resolves @bullfin/shared against. Without this step tsc either pulls shared's
# .ts source into the program (TS6059 rootDir error) or fails to resolve the
# types at all.
RUN pnpm --filter @bullfin/shared build \
 && pnpm --filter @bullfin/api build

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

# @bullfin/shared is a type-only dep — every import from it in apps/api uses
# `import type`, which TypeScript erases at compile time. The built dist has
# no runtime reference, so we skip shipping its source / node_modules entirely
# (saves ~60MB and avoids the "shared has no deps, so no node_modules folder
# exists to copy" build failure).
COPY --chown=bullfin:bullfin --from=prod-deps /app/node_modules ./node_modules
COPY --chown=bullfin:bullfin --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=bullfin:bullfin --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=bullfin:bullfin --from=build /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
