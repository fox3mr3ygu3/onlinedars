# Handoff log

Newest entry first. Each session adds one entry before ending, so work can continue on any PC.

<!--
## YYYY-MM-DD — <agent> — <branch>
- Done: …
- Next: …
- Blockers / questions: …
-->

## 2026-11-23 — frontend-public — feat/web-public

- Done: public site + auth + checkout + shared web auth layer. Pages: `/` (hero, steps, directions, recommended courses, CTAs), `/courses` (search, direction + price filters, pagination), `/courses/[slug]` (description, goals, program, teachers, price, Buy/Start, JSON-LD), `/directions`, `/teachers`, `/faq` (FAQPage JSON-LD), `/login`, `/register` (phone + SMS OTP or email), `/forgot-password` (code + new password), `/checkout/[courseId]` (summary, Payme/Click, redirect; with `?orderId=` it polls the order), `/checkout/result?orderId=` (polls), `/verify` + `/verify/[certificateId]`, `robots.txt`, `sitemap.xml`. Public header (responsive menu, session-aware) and footer. Auth layer `apps/web/src/lib/auth` (API documented in `index.ts`), `src/middleware.ts` role redirects with the `od_role` hint cookie. Typed clients `src/lib/api/{public,auth,orders}.ts`.
- Tests: 68 Vitest tests (auth layer: refresh on 401, single flight, failed refresh; middleware rules; order polling PENDING→PAID / FAILED / timeout / fatal; auth forms incl. OTP; checkout form incl. 503 provider; catalog; verify). Playwright: `e2e/playwright.config.ts` + `e2e/public/*`; 11 `@smoke` specs pass locally against the built app with the API mocked; the catalog spec needs the real API (CI only).
- Verified locally: lint, typecheck, unit tests, `next build`, Playwright smoke (chromium). Not verified: pages against the real API (backends are on other branches; shapes follow the coordinator's contract), Playwright in CI with the real API.
- Next: after merging the backend branches, check real response shapes (Requests in docs/TASKS.md: `search` vs `q`, course detail fields, `GET /courses/:id`, `errors.PAYMENT_PROVIDER_UNAVAILABLE`, shared response schemas, `NEXT_PUBLIC_SITE_URL`).
- Blockers / questions: none blocking.

## 2026-11-22 — architect — feat/phase-0-foundation

- Done: Phase 0 foundation. pnpm + Turborepo monorepo (scripts match the devops CI contract), packages/tsconfig, packages/eslint-config, Prettier, Husky + lint-staged. packages/shared (enums, 4x6 constants, error codes, zod schemas). apps/api: NestJS 11, /api/v1, Swagger /api/docs, pino, zod env validation, Sentry (DSN-guarded), /health, worker entry. Full Prisma schema + migration 0001_init (with 4x6 DB triggers) + idempotent seed. Auth (email/phone + argon2, OTP via Eskiz or console, JWT 15m + rotating refresh cookie, sessions, logout, forgot/reset), global JwtAuthGuard + RolesGuard, ownership helpers, users/me. apps/web: Next.js 15, Tailwind v4, shadcn base components, next-intl uz, route-group layouts. infra/docker-compose.yml, infra/backup/pg_dump.sh, README.
- Verified locally: pnpm install, lint, typecheck, test (71 unit tests), build; API boots and answers /health, /api/docs, 401 and 400 without a DB; test:e2e skips cleanly without DATABASE_URL.
- Only verified in CI (no Docker/Postgres on this PC): migrate deploy, migrate diff drift check, seed, and the 20 API e2e tests (incl. DB triggers).
- Next: watch the first CI run on this branch / PR; Phase 1 agents can start (see Requests in docs/TASKS.md).
- Blockers / questions: see docs/USER_ACTIONS.md (Eskiz template approval added). Owner for apps/web/src/middleware.ts is undecided.

## 2026-11-22 — devops — chore/ci-cd

- Done: CI (`.github/workflows/ci.yml`), deploy to GHCR + staging/production over SSH (`deploy.yml`, `.github/actions/ssh-deploy`), Dependabot, PR template, CODEOWNERS; Dockerfiles for web/api/worker, `infra/docker-compose.prod.yml`, Caddyfile, deploy/rollback/backup/server-setup scripts, restore guide, k6 load tests, CHANGELOG, release process docs.
- Next: once the architect's monorepo is on the branch, watch the first CI run (Dockerfiles were never built locally — no Docker on this PC). Then backups (nightly + off-server), monitoring (Sentry releases, uptime → Telegram).
- Blockers / questions: requests to architect/backend-learning/qa in `docs/TASKS.md`; GitHub Environments, branch protection and servers in `docs/USER_ACTIONS.md`; MinIO image plan.

## 2026-11-22 — setup — main

- Done: cloned the repo to `C:\dev\onlinedars`. The old OneDrive copy (`Desktop\platform`) is retired.
- Next: open `C:\dev\onlinedars` in Claude and run Phase 0 with the `architect` and `devops` agents.
- Blockers / questions: none.

## 2026-11-22 — setup — main

- Done: project docs, the onlinedars-stack skill, 9 agent definitions, git/CI/CD/deployment plans; private repo created on GitHub.
- Next: clone into `C:\dev\onlinedars` (outside OneDrive), then run Phase 0 with the `architect` and `devops` agents.
- Blockers / questions: hosting provider (data residency in Uzbekistan) and final stack approval from the client.
