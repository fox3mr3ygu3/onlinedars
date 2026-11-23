# Deployment, operations & scaling

## Environments

| Env        | URL (example)              | Deployed when              | Data             | Payments                  |
| ---------- | -------------------------- | -------------------------- | ---------------- | ------------------------- |
| local      | `localhost:3000` / `:4000` | `pnpm dev`                 | seed data        | none (mocked)             |
| staging    | `staging.onlinedars.uz`    | every merge to `main`      | seed + test data | Payme/Click **test mode** |
| production | `onlinedars.uz`            | tag `v*` + manual approval | real             | live merchant keys        |

Staging and production are separate servers (or at least separate databases, storage buckets and secrets).

## Hosting

- **Data residency:** Uzbek law is understood to require personal data of Uzbek citizens to be stored on servers in Uzbekistan. **Confirm this with legal counsel**, then pick a local cloud or data-center provider for production.
- Start with **one Linux VPS** (Ubuntu LTS, 4–8 vCPU, 8–16 GB RAM, SSD) per environment.
- Run everything with **Docker Compose**: `caddy` (HTTPS reverse proxy, automatic Let's Encrypt), `web`, `api`, `worker` (BullMQ jobs), `postgres`, `redis`, `minio`.
- DNS: `onlinedars.uz` → the server. Caddy serves web and API on the **same origin** (`/api/*` → api container), and `files.onlinedars.uz` → MinIO for presigned downloads. Same-origin keeps auth cookies first-party and lets one web image serve staging and production (`NEXT_PUBLIC_API_URL=/api/v1`).
- Payme/Click callbacks need a public HTTPS URL. Register the staging and production callback URLs in each merchant cabinet.

## CI (GitHub Actions — `.github/workflows/ci.yml`)

Runs on every push and PR (a newer push cancels the older run). Jobs run in parallel:

| Job                  | What                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint + typecheck     | `pnpm install --frozen-lockfile` (pnpm store cached), `db:generate`, `lint`, `typecheck`                                                                                  |
| Unit tests           | `pnpm test` (Vitest, no DB)                                                                                                                                               |
| API e2e + migrations | Postgres 16 + Redis 7 service containers; `db:migrate:deploy` on a fresh DB, `prisma migrate diff --exit-code` (schema has no un-migrated changes), `db:seed`, `test:e2e` |
| Build                | `pnpm build`                                                                                                                                                              |
| Playwright smoke     | only when `e2e/playwright.config.*` exists; runs tests tagged `@smoke` (full suite nightly, later)                                                                        |
| Docker images build  | builds web/api/worker images without pushing (not on `main`, where deploy builds them)                                                                                    |
| Dependency audit     | `pnpm audit --prod --audit-level=high`, reported but not blocking                                                                                                         |

Shared setup lives in `.github/actions/setup` (pnpm version comes from `packageManager` in the root `package.json`).

Branch protection on `main`: require CI green and 1 review (self-review is fine when solo), and no direct pushes.

## CD (`.github/workflows/deploy.yml`)

```
merge to main ─► build Docker images (web, api, worker)
              ─► push to GHCR (ghcr.io/<owner>/onlinedars-{web,api,worker}:<full sha> and :main)
              ─► SSH to staging ─► docker compose pull ─► prisma migrate deploy ─► up -d ─► health check

push tag v* ──► images built from the tagged commit, tagged :<sha>, :v1.2.0, :v1.2
              ─► GitHub Environment "production" (manual approval)
              ─► SSH to production ─► backup DB ─► migrate ─► up -d ─► health check ─► notify
```

- The workflow uploads `infra/docker-compose.prod.yml`, `infra/caddy/Caddyfile` and `infra/scripts/{deploy,rollback,backup-db}.sh` to `/opt/onlinedars`, writes `/opt/onlinedars/.env` from the `ENV_FILE` secret, logs in to GHCR with the run's own token, and runs `scripts/deploy.sh <tag>` (`.github/actions/ssh-deploy`).
- **Health check:** api `GET /api/v1/health` and web `/` must be healthy within 90 s (container healthchecks), then the public URL is checked through Caddy. If not healthy, `deploy.sh` starts the previous tag again and the job fails.
- **Rollback:** Actions → Deploy → _Run workflow_ → environment + `image_tag` (e.g. `v1.1.0` or a commit sha). On the server: `./scripts/rollback.sh [tag]`. Rollbacks never run migrations. Migrations must be **backward-compatible** (expand → migrate data → contract in a later release), so old code still runs on the new schema.
- **Worker** image = api image + Chromium (Puppeteer certificate PDFs); runs `node dist/worker.js`.

### Turning on deploys (once a server exists)

Deploy jobs are **skipped** until the repo variable for that environment exists, so CI stays green before there are servers.

1. Prepare the server: `infra/scripts/server-setup.sh` (see its header). Point DNS for `SITE_DOMAIN` and `FILES_DOMAIN` at it.
2. Repo → Settings → Secrets and variables → Actions → **Variables** (repository level, not secret):
   `STAGING_HOST`, `STAGING_URL` (e.g. `https://staging.onlinedars.uz`), later `PRODUCTION_HOST`, `PRODUCTION_URL`.
3. Repo → Settings → Environments → `staging` and `production`, each with **secrets**:
   | Secret                                   | Value                                                                           |
   | ---------------------------------------- | ------------------------------------------------------------------------------- |
   | `SSH_PRIVATE_KEY`                        | private key of the server's `deploy` user (ed25519, made for this purpose only) |
   | `SSH_KNOWN_HOSTS`                        | output of `ssh-keyscan -t ed25519 <host>`                                       |
   | `ENV_FILE`                               | the whole server `.env` (template: `infra/docker/prod.env.example`)             |
   | `SSH_USER`, `SSH_PORT`                   | optional, default `deploy` / `22`                                               |
   | `GHCR_USER`, `GHCR_TOKEN`                | optional; default is the run's `GITHUB_TOKEN`                                   |
   | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional deploy notifications                                                   |
4. `production` environment: add yourself as **required reviewer** and restrict deployment to tags `v*`.

## Backups

- Nightly `pg_dump` (compressed) plus MinIO bucket sync, copied **off-server** (a second provider or location). Keep 7 daily, 4 weekly and 6 monthly copies.
- Back up before every production deploy.
- **Practise a restore monthly** on staging, and write down how long it takes.

## Monitoring & alerts

- **Sentry** (web + api + worker): errors with release tags.
- **Uptime monitor** (e.g. UptimeRobot or Better Stack) on `/`, `/health` and the payment callback endpoints. Alerts go to Telegram.
- **Server metrics:** CPU, RAM, disk, DB connections (Netdata, or Grafana + Prometheus later).
- **Logs:** pino JSON → `docker logs` with rotation. Centralize (Loki) once there is more than one server.
- **Business alerts:** payment stuck in PENDING over 15 min, certificate job failures, 5xx rate above 1%.

## Security checklist

- SSH key login only, firewall (ports 22, 80, 443 only), fail2ban, automatic OS security updates.
- DB, Redis and MinIO are **not** exposed publicly (Docker internal network only).
- Rate limiting on auth, OTP and exam submit; CORS limited to our domains; secure cookies.
- Dependabot + `pnpm audit` in CI; review and update dependencies monthly.

## Scaling stages (move to the next only when monitoring shows the need)

| Stage | Setup                                                                         | Rough capacity*                    |
| ----- | ----------------------------------------------------------------------------- | ---------------------------------- |
| 1     | Single server, Docker Compose                                                 | first few thousand active students |
| 2     | + CDN for static files, images and video; object storage off-server           | big drop in server bandwidth       |
| 3     | PostgreSQL on its own server / managed DB, connection pooling (PgBouncer)     | —                                  |
| 4     | 2+ app servers behind a load balancer; Redis shared; worker scaled separately | tens of thousands                  |
| 5     | DB read replica for reports, caching hot catalog data in Redis                | —                                  |

\*Estimates only. **Load-test with k6 before launch** (e.g. 1,000 students submitting an exam at the same minute) and set the real numbers here.

The app is designed to scale out: stateless API (JWT + Redis), files in S3, heavy work (PDF, SMS, payment re-checks) in BullMQ queues.

## Maintenance routine

| When              | Task                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| Daily (automatic) | backups, error alerts, uptime                                              |
| Weekly            | review Sentry, Dependabot PRs, stuck payments                              |
| Monthly           | restore test, dependency updates, disk and DB size check, security patches |
| Each release      | changelog (`CHANGELOG.md`), tag, staging check, prod deploy, smoke test    |
| Yearly            | rotate secrets and merchant keys, review hosting size and cost             |
