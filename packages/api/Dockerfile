# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
# Install all deps (including devDeps for build)
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/api/ ./packages/api/
# Build shared first, then API
RUN pnpm --filter @governance/shared build && \
    pnpm --filter @governance/api build

# ---- Production ----
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace config for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/shared/dist/ ./packages/shared/dist/
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/api/dist/ ./packages/api/dist/
COPY --from=build /app/packages/api/package.json ./packages/api/

# Copy migration files and drizzle config
COPY packages/api/src/db/migrations/ ./packages/api/dist/db/migrations/
COPY packages/api/drizzle.config.ts ./packages/api/

# Copy entrypoint
COPY packages/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

WORKDIR /app/packages/api
EXPOSE 4000

ENTRYPOINT ["/docker-entrypoint.sh"]
