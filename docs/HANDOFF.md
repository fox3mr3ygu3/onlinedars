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
