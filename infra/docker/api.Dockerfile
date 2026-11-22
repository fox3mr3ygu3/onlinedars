# syntax=docker/dockerfile:1.7
# NestJS API and the BullMQ worker. Build from the repo root:
#   docker build -f infra/docker/api.Dockerfile --target api    -t onlinedars-api .
#   docker build -f infra/docker/api.Dockerfile --target worker -t onlinedars-worker .
# The worker image = api image + Chromium for Puppeteer (certificate PDFs), so the api
# image stays small. Entry points expected: dist/main.js (api), dist/worker.js (worker).

ARG NODE_IMAGE=node:22-bookworm-slim
ARG PNPM_VERSION=9.15.9

# ---------- base: node + pnpm + openssl (Prisma engines need it) ----------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    npm_config_store_dir=/pnpm/store \
    TURBO_TELEMETRY_DISABLED=1 \
    # Chromium comes from apt in the worker stage; never download it during install.
    PUPPETEER_SKIP_DOWNLOAD=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo

# ---------- deps ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch

# ---------- build ----------
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline
# Turbo runs db:generate and builds workspace dependencies (packages/shared) first;
# shared's dist/ is excluded from the build context.
RUN pnpm turbo run build --filter=@onlinedars/api
# Self-contained production copy of apps/api (prod deps only, workspace packages included).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter ./apps/api deploy --prod /out/api \
 && rm -rf /out/api/dist /out/api/prisma \
 && cp -r apps/api/dist /out/api/dist \
 && cp -r apps/api/prisma /out/api/prisma
# Prisma CLI pinned to the exact @prisma/client version, used for generate here and
# for "migrate deploy" at release time (it is a devDependency, so not in /out).
RUN PRISMA_VERSION="$(node -p "require('/out/api/node_modules/@prisma/client/package.json').version")" \
 && npm install -g "prisma@${PRISMA_VERSION}" \
 && cd /out/api && prisma generate --schema prisma/schema.prisma

# ---------- api runtime ----------
FROM ${NODE_IMAGE} AS api
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    PORT=4000 \
    APP_VERSION=${APP_VERSION} \
    PUPPETEER_SKIP_DOWNLOAD=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
# Same global prisma CLI as the build stage, for `prisma migrate deploy`.
COPY --from=build /usr/local/lib/node_modules/prisma /usr/local/lib/node_modules/prisma
RUN ln -s /usr/local/lib/node_modules/prisma/build/index.js /usr/local/bin/prisma \
 && chmod +x /usr/local/lib/node_modules/prisma/build/index.js
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]

# ---------- worker runtime (BullMQ: certificate PDFs, notifications, payment re-checks) ----------
FROM api AS worker
USER root
# Chromium + fonts covering Uzbek Latin (o‘, g‘) for Puppeteer-rendered certificates.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation fonts-noto-core \
 && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
USER node
HEALTHCHECK NONE
CMD ["node", "dist/worker.js"]
