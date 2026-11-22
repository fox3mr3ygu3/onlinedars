# syntax=docker/dockerfile:1.7
# Next.js 15 web app (all three panels). Build from the repo root:
#   docker build -f infra/docker/web.Dockerfile -t onlinedars-web .
# Requires apps/web/next.config.* to set output: "standalone" and
# outputFileTracingRoot to the repo root (see docs/DECISIONS.md).

ARG NODE_IMAGE=node:22-bookworm-slim
ARG PNPM_VERSION=9.15.9

# ---------- base: node + pnpm ----------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@${PNPM_VERSION} && pnpm --version
WORKDIR /repo

# ---------- deps: fetch the store from the lockfile only (good layer cache) ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch

# ---------- build ----------
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline
# The browser talks to the API on the same origin (Caddy routes /api/* to the api container),
# so this is environment-independent and one image serves staging and production.
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_APP_VERSION=${APP_VERSION} \
    NODE_ENV=production
# Turbo builds every workspace dependency first (build dependsOn ^build), e.g. packages/shared
# whose dist/ is excluded from the build context.
RUN pnpm turbo run build --filter=@onlinedars/web

# ---------- runner: only the standalone output ----------
FROM ${NODE_IMAGE} AS runner
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
# The official node image already ships an unprivileged "node" user (uid 1000).
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
