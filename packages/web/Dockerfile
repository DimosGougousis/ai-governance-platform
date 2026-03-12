# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/web/ ./packages/web/

# Build shared first, then web (standalone output)
ARG NEXT_PUBLIC_API_URL=http://localhost/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost/api
RUN pnpm --filter @governance/shared build && \
    pnpm --filter @governance/web build

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app

# Copy standalone output
COPY --from=build /app/packages/web/.next/standalone/ ./
COPY --from=build /app/packages/web/.next/static/ ./packages/web/.next/static/
COPY --from=build /app/packages/web/public/ ./packages/web/public/

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "packages/web/server.js"]
