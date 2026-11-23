# Handoff log

Newest entry first. Each session adds one entry before ending, so work can continue on any PC.

<!--
## YYYY-MM-DD — <agent> — <branch>
- Done: …
- Next: …
- Blockers / questions: …
-->

## 2026-11-23 — frontend-admin — feat/web-admin

- Done: full /admin panel against the agreed API contract. Sidebar shell (drawer below lg) with the menu filtered by role. Pages: dashboard; courses list/create/edit with status draft/publish/hide/archive, free/paid with price typed in so'm and sent as tiyin, sequentialUnlock, direction, teachers, certificate template; program editor (modules + lessons, drag or keyboard reorder); lesson editor (rich text, image/file upload, video URL materials) and publish panel; practices board ("Amaliyotlar n/4", "Savollar n/6", add disabled at the limit, publish disabled until the server says 4×6 is ready); question editor for all 5 types with shared-zod validation; exam config + exam question pool; certificate templates with a sandboxed live preview; students list/detail (grant/revoke access, progress, results); payments with filters and an ADMIN-only status dialog that requires a reason; reports; settings (ADMIN); audit log; directions/teachers/FAQ CRUD. API functions are in `apps/web/src/lib/api/admin/*`; i18n is under `admin.*` in uz.json.
- Tests: 53 Vitest (4×6 counters/disabled states, validation per question type, reorder logic + keyboard/DnD, role menu, payment dialog, ICU validity of every admin message, money/date helpers). 12 Playwright runs (6 specs × desktop/375px) in `e2e/admin/admin.spec.ts`, all `@smoke`, API mocked with page.route. Root lint + typecheck + test + build all green locally.
- Not verified: against the real backend (the API branches were built in parallel), file upload end to end, and the rich-text editor in Safari.
- Next: after `feat/web-public` merges, point `setAdminAccessTokenProvider` at `getSession()` (see Requests in TASKS.md) so one refresh flow runs per tab; then check response shapes against the content, learning and payments APIs.
- Blockers / questions: none for the user.

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
