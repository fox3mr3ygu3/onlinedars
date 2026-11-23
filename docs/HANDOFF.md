# Handoff log

Newest entry first. Each session adds one entry before ending, so work can continue on any PC.

<!--
## YYYY-MM-DD — <agent> — <branch>
- Done: …
- Next: …
- Blockers / questions: …
-->

## 2026-11-23 — backend-learning — feat/learning-api

- Route contract: exactly as the coordinator's list, saved in `docs/api/ROUTES.md`. Additions: `GET /me/exam-attempts/:attemptId`, `PUT /me/exam-attempts/:attemptId/answers` (autosave), `POST /admin/certificate-templates/preview`. Practice "start" = `GET /me/practices/:id` (attempt row is created on submit).
- Done: modules `progress` (course tree + locks, lesson view, material viewed, practices with server grading of all 5 types, lesson/course progress, student dashboard), `exams` (admin config + question pool CRUD, unlock after required lessons, timed attempts with 30 s grace, autosave, auto-grade, results), `certificates` (auto-issue once per user+course, `OD-XXXX-XXXX-XXXX` IDs, BullMQ `certificate-pdf` job processed in the worker or inline without REDIS_URL, Puppeteer + S3 behind interfaces, public verify, owner-only PDF download, admin templates CRUD + preview), `reports` (admin dashboard, course/exam/activity reports), `students` (admin list/profile, grant/revoke access with AuditLog). Shared types in `packages/shared/src/schemas/learning.ts`; 6 new error codes + uz messages; `PUPPETEER_EXECUTABLE_PATH` in `.env.example`.
- Schema changes: none (no migration).
- New deps (apps/api): bullmq, puppeteer-core, @aws-sdk/client-s3 (see DECISIONS).
- Verified locally: lint, typecheck, unit tests (api 215 incl. ~140 new), build (`dist/main.js`, `dist/worker.js`); built API boots without DB/Redis and serves all learning routes in OpenAPI; verify returns 404 `CERTIFICATE_NOT_FOUND`, `/me/*` 401 without a token. `test:e2e` skips cleanly without DATABASE_URL.
- Only verified in CI: `apps/api/test/learning.e2e-spec.ts` (16 tests against the seeded demo course), the raw SQL in reports/advisory lock, real BullMQ + Chromium rendering.
- Next: coordinator to unify `CertificateStorage` with backend-content's StorageService; watch the first CI run of the e2e spec.
- Blockers / questions: see `docs/USER_ACTIONS.md` (Chrome path for local PDFs; confirm retake/timeout policy with the client).

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
