# Deployment, operations & scaling

## Environments
| Env | URL (example) | Deployed when | Data | Payments |
|---|---|---|---|---|
| local | `localhost:3000` / `:4000` | `pnpm dev` | seed data | none (mocked) |
| staging | `staging.onlinedars.uz` | every merge to `main` | seed + test data | Payme/Click **test mode** |
| production | `onlinedars.uz` | tag `v*` + manual approval | real | live merchant keys |

Staging and production are separate servers (or at least separate databases, storage buckets and secrets).

## Hosting
- **Data residency:** Uzbek law is understood to require personal data of Uzbek citizens to be stored on servers in Uzbekistan. **Confirm this with legal counsel**, then pick a local cloud or data-center provider for production.
- Start with **one Linux VPS** (Ubuntu LTS, 4–8 vCPU, 8–16 GB RAM, SSD) per environment.
- Run everything with **Docker Compose**: `caddy` (HTTPS reverse proxy, automatic Let's Encrypt), `web`, `api`, `worker` (BullMQ jobs), `postgres`, `redis`, `minio`.
- DNS: `onlinedars.uz` → web, `api.onlinedars.uz` → api (or `/api` behind the same proxy).
- Payme/Click callbacks need a public HTTPS URL. Register the staging and production callback URLs in each merchant cabinet.

## CI (GitHub Actions — `.github/workflows/ci.yml`)
Runs on every push and PR:
1. `pnpm install --frozen-lockfile` (cached)
2. lint + typecheck
3. unit tests (Vitest)
4. API e2e (Supertest against Postgres + Redis service containers)
5. `prisma migrate deploy` on a fresh database (checks that migrations apply)
6. build web + api
7. Playwright smoke tests (full suite nightly)

Branch protection on `main`: require CI green and 1 review (self-review is fine when solo), and no direct pushes.

## CD (`.github/workflows/deploy.yml`)
```
merge to main ─► build Docker images (web, api, worker)
              ─► push to GHCR (ghcr.io/<owner>/onlinedars-*:sha)
              ─► SSH to staging ─► docker compose pull ─► prisma migrate deploy ─► up -d ─► health check

push tag v* ──► same images re-tagged :v1.2.0
              ─► GitHub Environment "production" (manual approval)
              ─► SSH to production ─► backup DB ─► migrate ─► up -d ─► health check ─► notify
```
- **Secrets** come from GitHub Environments (`staging`, `production`): SSH key, `.env` contents, registry token.
- **Health check:** `GET /health` must return 200 within 60 s, otherwise the job fails and the previous version keeps running.
- **Rollback:** re-run deploy with the previous tag (`IMAGE_TAG=v1.1.0`). Migrations must be **backward-compatible** (expand → migrate data → contract in a later release), so old code still runs on the new schema.

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
| Stage | Setup | Rough capacity* |
|---|---|---|
| 1 | Single server, Docker Compose | first few thousand active students |
| 2 | + CDN for static files, images and video; object storage off-server | big drop in server bandwidth |
| 3 | PostgreSQL on its own server / managed DB, connection pooling (PgBouncer) | — |
| 4 | 2+ app servers behind a load balancer; Redis shared; worker scaled separately | tens of thousands |
| 5 | DB read replica for reports, caching hot catalog data in Redis | — |

\*Estimates only. **Load-test with k6 before launch** (e.g. 1,000 students submitting an exam at the same minute) and set the real numbers here.

The app is designed to scale out: stateless API (JWT + Redis), files in S3, heavy work (PDF, SMS, payment re-checks) in BullMQ queues.

## Maintenance routine
| When | Task |
|---|---|
| Daily (automatic) | backups, error alerts, uptime |
| Weekly | review Sentry, Dependabot PRs, stuck payments |
| Monthly | restore test, dependency updates, disk and DB size check, security patches |
| Each release | changelog (`CHANGELOG.md`), tag, staging check, prod deploy, smoke test |
| Yearly | rotate secrets and merchant keys, review hosting size and cost |
