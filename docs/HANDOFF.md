# Handoff log

Newest entry first. Each session adds one entry before ending, so work can continue on any PC.

<!--
## YYYY-MM-DD — <agent> — <branch>
- Done: …
- Next: …
- Blockers / questions: …
-->

## 2026-11-23 — backend-content — feat/content-api

- Routes: exactly the backend-content part of the coordinator's contract (saved as `docs/api/ROUTES.md`), plus additive extras: `GET /admin/{directions,teachers,faq}/:id`, `GET /admin/questions/:id`, `PATCH /admin/lessons/:id/materials/reorder`, `PATCH /admin/lessons/:id/practices/reorder`, `PATCH /admin/practices/:id/questions/reorder`, `GET /settings/public`, `GET /files/:year/:month/:name` (local storage driver only). Completeness returns the contract fields `{practices, required, questionsPerPractice[], ready}` plus `lessonId, isPublished, questionsRequired, totalQuestions`; DELETE practice/question returns 200 `{deleted, lessonUnpublished}`.
- Done: Nest modules courses (public + admin), modules, lessons (+ materials, completeness, publish/unpublish), practices, questions (5 types, options, explanation), directions, teachers, faq, files (StorageService: S3 SigV4 / local disk / memory), settings (ADMIN, audit-logged). 4×6 limits in services + DB-trigger error mapping, publish rules, course publish/delete rules, answer-stripping mapper for backend-learning. Shared zod schemas: `packages/shared/src/schemas/{catalog,content-admin,files,settings}.ts`. New error codes: SLUG_TAKEN, COURSE_INCOMPLETE, COURSE_NOT_DELETABLE, REORDER_MISMATCH, FILE_REQUIRED, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED (+ uz.json).
- Schema changes: none (no migration).
- Verified locally: shared + api lint, typecheck, unit tests (api 164, shared 22), `nest build`; built API booted without a DB: all routes in OpenAPI, admin route → 401, unknown file → 404. Full-repo `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all green.
- CI-only: `apps/api/test/content.e2e-spec.ts` (19 tests, needs Postgres) — skipped locally.
- Next: coordinator merges; watch the content e2e in CI. Follow-ups: rich-text sanitiser library if the client wants richer HTML; optional presigned/private downloads for paid lesson files.
- Blockers / questions: bucket read policy (see USER_ACTIONS). Note: the first WIP commit on this branch was made with `--no-verify` by mistake (files were formatted afterwards).

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
