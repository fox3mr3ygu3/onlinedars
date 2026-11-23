# Handoff log

Newest entry first. Each session adds one entry before ending, so work can continue on any PC.

<!--
## YYYY-MM-DD — <agent> — <branch>
- Done: …
- Next: …
- Blockers / questions: …
-->

## 2026-11-23 — coordinator — feat/phase-0-foundation

- Overnight autonomous run (user asleep, said carry on without confirmation; merge to `main` only after green CI).
- Phase 0: PR #1 (`feat/phase-0-foundation` → `main`) open. CI: lint, typecheck, unit, API e2e + migrations, build, Playwright smoke PASS; Docker image builds fail (`@onlinedars/shared` dist not built in image) and the audit job blocks. devops is fixing on `chore/ci-fix`; merge that into phase-0, then merge PR #1 when green.
- Phase 1 in progress, one branch per agent, all based on `origin/feat/phase-0-foundation`: `feat/content-api`, `feat/learning-api` (also owns admin `/admin/students*`), `feat/payments-api`, `feat/web-public` (also owns `src/lib/auth/**`, `src/middleware.ts`, `src/lib/api/client.ts`), `feat/web-student`, `feat/web-admin`.
- Shared API route contract: `docs/api/ROUTES.md` (each Phase 1 branch adds it).
- i18n: each frontend agent writes only its own namespaces in `apps/web/messages/uz.json`; expect easy merge conflicts there.
- If you continue on another PC: check which Phase 1 branches exist on GitHub (`git ls-remote --heads origin`), read each branch's HANDOFF entry, resume unfinished agents on their branch, then integrate: merge phase-1 branches one by one into an integration branch off `main`, fix conflicts, run `pnpm lint typecheck test build`, push, wait for CI, merge.
- Usage limit hit once around 01:00; all agents were resumed afterwards.

## 2026-11-23 — backend-payments — feat/payments-api

- Route contract: implemented exactly as given by the coordinator (saved in `docs/api/ROUTES.md`). Additive differences only: `POST /orders` paid response also has `enrolled:false, currency, provider, status` and free response is `{enrolled:true, courseId}`; `/admin/payments` also takes `userId, minAmount, maxAmount, page, pageSize`; `PATCH /admin/payments/:id/status` → `:id` is the orderId; extra `POST /me/notifications/read-all`.
- Done: orders (amount from DB, free → direct enrollment, open-order reuse, Payme/Click redirect URLs from config), order status poll + own history, Payme Merchant API (all 6 methods, Basic auth, Payme error codes, 12 h timeout, refund via CancelTransaction), Click Prepare/Complete (MD5 sign, Click error codes), idempotent fulfilment (row lock + conditional update; status + enrollment + notification in one transaction), REFUND_POLICY (revoke|keep, default revoke), worker `payment-recheck` job (BullMQ, in-process fallback without REDIS_URL, provider check behind `PaymentStatusChecker`), admin payments list/filters + restricted status change with AuditLog, global `AuditService` + `GET /admin/audit-logs`, in-app notifications + no-op email/SMS channels. Docs: `docs/api/payments.md`.
- Schema: **no Prisma changes**. New dep: `bullmq` in apps/api. New env vars (optional) in `.env.example` + `apps/api/src/config/env.ts`. New error codes `COURSE_NOT_PURCHASABLE`, `PAYMENT_PROVIDER_UNAVAILABLE`, `INVALID_STATUS_TRANSITION` (shared + uz.json). Shared zod schemas extended in `packages/shared/src/schemas/payments.ts`.
- Verified locally: lint, typecheck, unit tests (api 138 incl. ~80 payments/notifications/audit), build. Only in CI (no Docker/Postgres here): `apps/api/test/payments.e2e-spec.ts` (Payme + Click full flows over HTTP, duplicates, amount mismatch, ownership, admin + audit) and the real row locks.
- Next: watch CI e2e; wire a real `PaymentStatusChecker` / email provider when credentials exist; sandbox runs (docs/USER_ACTIONS.md).
- Blockers / questions: refund policy confirmation, provider test credentials (USER_ACTIONS). Requests to backend-content / frontend-public / frontend-admin / backend-learning added in docs/TASKS.md.

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
