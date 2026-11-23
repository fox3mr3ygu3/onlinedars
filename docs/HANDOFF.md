# Handoff log

Newest entry first. Each session adds one entry before ending, so work can continue on any PC.

<!--
## YYYY-MM-DD — <agent> — <branch>
- Done: …
- Next: …
- Blockers / questions: …
-->

## 2026-11-23 — frontend-student — feat/web-student

- Done: whole student cabinet under `/cabinet`: sidebar/topbar layout (mobile slide-over menu, unread bell), dashboard (overall progress, stats, last activity, my courses), my courses, course tree with module/lesson locks + progress + exam card, lesson viewer (sanitised rich text/markdown, images, files, YouTube/Vimeo/video, "material viewed" button + auto-mark, 4 practice cards, prev/next), practice player for all 5 types (MC single/multi, TRUE_FALSE, MATCHING click-to-pair + drag, FILL_BLANK inline inputs, IMAGE_BASED) with unanswered warning and graded result + explanations + retry, exam (lock reason, start/resume, server-deadline countdown with skew correction, localStorage autosave, confirm submit, auto-submit at deadline, result), results, certificates (PDF download with session, verify link, polling while the PDF is pending), payment history, notifications (filter, mark read), profile (edit name/email, change password). Typed clients `lib/api/learning.ts`, `lib/api/me.ts`; i18n in uz.json.
- Tests: 43 Vitest (question types, practice flow, exam timer/auto-submit/autosave/storage failures, lock rendering, lesson viewer, content helpers) + 15 Playwright specs x 2 viewports (`e2e/cabinet/*`, API mocked, `@smoke`), all passing. Root `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Not verified: against the real API (backends built in parallel; contract taken from the `feat/learning-api` / `feat/payments-api` shared schemas). Auth token wiring is pending (see Requests in TASKS.md): against a real API the cabinet shows the login prompt until `configureStudentAuth(authFetch…)` is added.
- Next: after merging web-public + learning/payments APIs: wire `configureStudentAuth` and `useRequireSession`, swap local types for `@onlinedars/shared`, run e2e against the seeded API.
- Blockers / questions: none.

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
