# Handoff log

Newest entry first. Each session adds one entry before ending, so work can continue on any PC.

<!--
## YYYY-MM-DD — <agent> — <branch>
- Done: …
- Next: …
- Blockers / questions: …
-->

## 2026-11-24 — frontend-student — feat/course-player

- Done: the lesson page is now a course player (Udemy-style layout). Full width (on that route only, the cabinet side nav moves into the top-bar menu), dark top strip with "Kursga qaytish" + course title, the lesson's first video on a dark 16:9 stage (not repeated in the materials), in-page tabs (Umumiy / Amaliyotlar / Kurs mazmuni on mobile), and a "Kurs mazmuni" sidebar: progress, collapsible sections "N-bo'lim: title" with "done/total | 1 soat 32 daq", lessons numbered across the course with a completion box, duration and practices, current lesson highlighted, locked lessons unlinked, exam row. The sidebar collapses on desktop; on mobile it sits under the lesson. No API changes (`GET /me/courses/:id` + `GET /me/lessons/:id`).
- Files: `features/lesson/CoursePlayer.tsx`, `features/lesson/player.ts`, `LessonVideo` in `LessonMaterials.tsx`, `LessonView` takes `stageMaterialId`, `CabinetShell` player mode, `cabinet.player` strings in uz.json.
- Verified: web lint, typecheck, 170 unit tests; Playwright `e2e/cabinet` 30/30 (desktop + mobile) against this branch's dev server; checked in the browser against the real API (desktop, collapsed sidebar, 375px with no horizontal scroll).
- Next: per-lesson material type icons (video vs text) need a field in the course tree API; optional notes tab.

## 2026-11-23 — coordinator — PRs #19, #20, #21 + feat/demo-seed (new PC: D:dev)

- New PC setup: repo at `D:dev` (user's choice, not C:devonlinedars). A local Windows PostgreSQL holds 5432, so Docker Postgres runs on **5433** (`POSTGRES_PORT` in `.env`). MinIO image is gone → `STORAGE_DRIVER=local`. pnpm installed globally for the user.
- Open PRs (each with green local checks; CI was running when written):
  - **#19** `fix/staff-enrollment`: POST /orders student-only; course page + checkout show staff a notice.
  - **#20** `chore/tech-followups`: security overrides (audit 12 → 3 unreachable), REDIS_URL optional, content-manager dashboard (403 → allowed, no money), merged ROUTES.md.
  - **#21** `feat/course-preview`: intro video + free preview lessons (migration 0002), RichText SSR fix.
  - **demo seed** `feat/demo-seed`: `pnpm db:seed:demo`.
- After #20 and #21 are both merged: add `GET /courses/:slugOrId/lessons/:lessonId/preview` to `docs/api/ROUTES.md`; optionally give demo courses intro videos / preview lessons in the demo seed.
- Lesson learned: run `@fullstack` specs only against the test DB (`onlinedars_test`), never against the dev servers — they create courses and users. A full-stack run also leaves test responses in `apps/web/.next` fetch cache for ~60 s.
- Dependabot: 14 PRs open; cancelled runs were re-run. Prisma bump (#7) fails CI and needs code changes; Postgres 19 / Redis 8 image bumps should wait for a planned DB upgrade.
- Next: user merges #19–#21 + demo seed PR; deployment setup is the remaining stage (docs/USER_ACTIONS.md).

## 2026-11-23 — coordinator — fix/admin-api-fields

- Found by clicking through the admin panel against the real API: the admin UI read field names from its old mock contract, so values showed blank or "—" (dashboard exams, course list lessons/students, student list courses, student profile, all 3 reports, module lesson badges). The payments list and status change used `payment.id` / `payment.course` (the API sends `orderId` / `courseTitle`) and would have broken once real payments existed.
- Fix: `apps/web/src/lib/api/admin/types.ts` now re-exports the API's own types from `@onlinedars/shared` (dashboard, reports, students, payments), and the pages use the real fields; dashboard shows recent exam results (the API sends those, not payments); activity report reads `{ days }`. Unit and Playwright admin mocks updated to the real shapes.
- Verified: each page in the browser against the seeded API; web lint, typecheck, 158 unit tests, admin smoke 12/12.
- Branch is based on `test/acceptance-e2e` (PR #14); merge #14 first.
- Next: other areas may have the same mock-vs-API drift; the cabinet and public pages were checked by the full-stack acceptance specs, the admin pages only partly.

## 2026-11-23 — qa — test/acceptance-e2e (finished, PR to main)

- Merged `main` (after PR #2) into the branch; HANDOFF conflict resolved by keeping both entries.
- Done: `e2e/playwright.config.ts` — acceptance specs run on desktop only, `acceptance/mobile-*.spec.ts` on mobile only. New specs: `admin.spec.ts` (§13.3 course created in the UI, edited; §13.4 counters, publish gate, 5th practice / 7th question / incomplete publish refused by the API, publish from the UI), `learning.spec.ts` (§13.5–13.8 locks, viewed + practices, progress 100 %, exam unlock, failed then passed attempt, one certificate, no retake, PDF 200/409 + other user 404, cabinet list, `/verify` valid + not found), `payment.spec.ts` (§13.9 checkout UI → Payme redirect intercepted, forged success return grants nothing, CheckPerform wrong amount → -31001, Create → Perform, repeated Perform idempotent, result page "paid", one enrollment, payment history), `mobile-cabinet.spec.ts` (§13.10 at 375px, no horizontal scroll).
- Bug found and fixed: login/register stayed on the auth page after success (`router.refresh()` right after `router.replace()` cancelled the navigation) — `features/auth/login-form.tsx`, `register-form.tsx`.
- Verified locally (Docker Postgres on 5433 + Redis, built API + web): `@fullstack` 11/11, `@smoke` 53/53, lint, typecheck, unit tests (api 410, web 158, shared 24).
- Next: watch the first CI run of the "Playwright full-stack (acceptance)" job; dedupe `docs/api/ROUTES.md` (still has several agents' copies; note `/courses/:slugOrId`).
- Blockers / questions: none.

## 2026-11-23 — qa — test/acceptance-e2e (paused, WIP)

- Paused on the coordinator's instruction (user stopping). Work is committed as `wip:`; nothing ran in CI yet for the new parts.
- Merged `origin/feat/phase-1-integration` twice (FILE_REQUIRED fix, ubuntu-24.04 runners). The last CI run before my changes (45099388320): lint, unit, API e2e, build, docker, audit green; Playwright smoke was still running when I paused.
- Done (not yet run in CI):
  - `.github/workflows/ci.yml`: new job `playwright-fullstack` ("Playwright full-stack (acceptance)", ubuntu-24.04, postgres:16 + redis:7, db generate/migrate/seed, build, `E2E_API=1 … --grep @fullstack`, test-only JWT/Payme/Click keys, STORAGE_DRIVER=memory, console SMS). Existing jobs unchanged.
  - `e2e/acceptance/support.ts`: helpers (API calls, register/login, browser sign-in via the /api/v1 proxy + `od_role` cookie, building a 4×6 lesson / published course through the admin API, perfect answers from admin question data, Payme JSON-RPC calls with Basic auth).
  - `e2e/acceptance/auth.spec.ts`: §13.1 register (email) in the UI → cabinet → profile; login form incl. a wrong password; §13.11 ownership/role denial through the API (other user's order, not-enrolled course/lesson, admin routes 403, anonymous 401) + middleware keeps a student out of /admin.
  - `e2e/acceptance/catalog.spec.ts`: §13.2 catalog search → course page; empty search state; checkout opens by course id.
  - API fix (mismatch): `GET /courses/:slug` now also resolves by id (`CoursesService.getPublicBySlug`, checkout passes the course id); unit test in `courses.service.spec.ts` (passes locally).
- Left (next steps, in order):
  1. `e2e/playwright.config.ts`: add `testIgnore` for `acceptance/**` in the mobile project (except a `acceptance/mobile-cabinet.spec.ts` smoke) and ignore that mobile spec in desktop.
  2. Write `admin.spec.ts` (§13.3 create/edit course, module, lesson in the UI; §13.4 counters, 5th practice / 7th question rejected via API, publish disabled until 4×6, then publish), `learning.spec.ts` (§13.5–13.8: viewed + practice in the UI, rest via API with perfect answers, lock/progress checks in the course tree, exam unlock, failed then passed attempt, certificate listed, `/verify/{id}` valid, PDF 200 or 409 CERTIFICATE_PDF_PENDING, other user's PDF 404), `payment.spec.ts` (§13.9: UI checkout → intercept the Payme redirect, `?orderId=&status=success` alone grants nothing, CheckPerform → Create → Perform, poll page shows paid, course in cabinet, duplicate Perform → one enrollment), `mobile-cabinet.spec.ts` (§13.10).
  3. Run `pnpm lint typecheck test build` locally, push, watch CI, fix web↔API mismatches the specs reveal (≤6 iterations), `test.fixme` what can't pass.
  4. Dedupe `docs/api/ROUTES.md` into one document (note the new `/courses/:slugOrId`).
  5. Tick qa items in TASKS.md (none ticked yet).
- Known limits: certificate PDFs use their own S3 storage (not STORAGE_DRIVER), so in CI the PDF stays pending (no worker, no MinIO); specs must accept CERTIFICATE_PDF_PENDING. Static check done: web `learning-types.ts` is type-identical to the shared learning schemas.
- Blockers / questions: none.

## 2026-11-23 — coordinator — feat/phase-1-integration (paused by the user)

- **State:** Phase 0 + all six Phase 1 branches are merged into `feat/phase-1-integration`. Local: lint, typecheck, build, 591 unit tests pass (api 409, web 158, shared 24). CI: API e2e 70/70 against Postgres, build and all Docker images pass. Playwright smoke failed only because `ubuntu-latest` became 26.04; all jobs are now pinned to `ubuntu-24.04` (commit 7aee946) and that CI run had not finished when work paused — check it first.
- **PR #1** (`feat/phase-0-foundation` → `main`) is green and waits for the user to merge (agents were not permitted to merge into `main`). After it, open a PR `feat/phase-1-integration` → `main`.
- **qa** is on `test/acceptance-e2e` (from the integration branch): full-stack Playwright specs for spec §13 (tag `@fullstack`) and a CI job with Postgres/Redis. Read its HANDOFF entry on that branch for what's written, what passed and what's left; continue there, then merge it into the integration branch.
- **Fixes made during integration:** one `refundPolicy` setting shared by settings and payments (`PaymentRefundPolicy` normalises REVOKE_ACCESS/KEEP_ACCESS); admin and cabinet API calls use the shared `authFetch`/`getSession` (no second refresh loop); `POST /admin/files` without a body → FILE_REQUIRED; one vitest config (node + jsdom projects) and one Playwright config (desktop + mobile, `E2E_API=1` for the real API; mobile skips `e2e/public/**` for now).
- **Known follow-ups:** certificates use their own S3 storage instead of `modules/files` StorageService (unify); `REDIS_URL` should be optional in config; high audit advisories (postcss via next, effect/deepmerge-ts via prisma) need overrides or upgrades; `docs/api/ROUTES.md` has several agents' copies appended (qa was asked to dedupe); see Requests in `docs/TASKS.md`.
- **User to-dos:** `docs/USER_ACTIONS.md`.

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

## 2026-11-23 — backend-content — feat/content-api

- Routes: exactly the backend-content part of the coordinator's contract (saved as `docs/api/ROUTES.md`), plus additive extras: `GET /admin/{directions,teachers,faq}/:id`, `GET /admin/questions/:id`, `PATCH /admin/lessons/:id/materials/reorder`, `PATCH /admin/lessons/:id/practices/reorder`, `PATCH /admin/practices/:id/questions/reorder`, `GET /settings/public`, `GET /files/:year/:month/:name` (local storage driver only). Completeness returns the contract fields `{practices, required, questionsPerPractice[], ready}` plus `lessonId, isPublished, questionsRequired, totalQuestions`; DELETE practice/question returns 200 `{deleted, lessonUnpublished}`.
- Done: Nest modules courses (public + admin), modules, lessons (+ materials, completeness, publish/unpublish), practices, questions (5 types, options, explanation), directions, teachers, faq, files (StorageService: S3 SigV4 / local disk / memory), settings (ADMIN, audit-logged). 4×6 limits in services + DB-trigger error mapping, publish rules, course publish/delete rules, answer-stripping mapper for backend-learning. Shared zod schemas: `packages/shared/src/schemas/{catalog,content-admin,files,settings}.ts`. New error codes: SLUG_TAKEN, COURSE_INCOMPLETE, COURSE_NOT_DELETABLE, REORDER_MISMATCH, FILE_REQUIRED, FILE_TOO_LARGE, FILE_TYPE_NOT_ALLOWED (+ uz.json).
- Schema changes: none (no migration).
- Verified locally: shared + api lint, typecheck, unit tests (api 164, shared 22), `nest build`; built API booted without a DB: all routes in OpenAPI, admin route → 401, unknown file → 404. Full-repo `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all green.
- CI-only: `apps/api/test/content.e2e-spec.ts` (19 tests, needs Postgres) — skipped locally.
- Next: coordinator merges; watch the content e2e in CI. Follow-ups: rich-text sanitiser library if the client wants richer HTML; optional presigned/private downloads for paid lesson files.
- Blockers / questions: bucket read policy (see USER_ACTIONS). Note: the first WIP commit on this branch was made with `--no-verify` by mistake (files were formatted afterwards).

## 2026-11-23 — frontend-admin — feat/web-admin

- Done: full /admin panel against the agreed API contract. Sidebar shell (drawer below lg) with the menu filtered by role. Pages: dashboard; courses list/create/edit with status draft/publish/hide/archive, free/paid with price typed in so'm and sent as tiyin, sequentialUnlock, direction, teachers, certificate template; program editor (modules + lessons, drag or keyboard reorder); lesson editor (rich text, image/file upload, video URL materials) and publish panel; practices board ("Amaliyotlar n/4", "Savollar n/6", add disabled at the limit, publish disabled until the server says 4×6 is ready); question editor for all 5 types with shared-zod validation; exam config + exam question pool; certificate templates with a sandboxed live preview; students list/detail (grant/revoke access, progress, results); payments with filters and an ADMIN-only status dialog that requires a reason; reports; settings (ADMIN); audit log; directions/teachers/FAQ CRUD. API functions are in `apps/web/src/lib/api/admin/*`; i18n is under `admin.*` in uz.json.
- Tests: 53 Vitest (4×6 counters/disabled states, validation per question type, reorder logic + keyboard/DnD, role menu, payment dialog, ICU validity of every admin message, money/date helpers). 12 Playwright runs (6 specs × desktop/375px) in `e2e/admin/admin.spec.ts`, all `@smoke`, API mocked with page.route. Root lint + typecheck + test + build all green locally.
- Not verified: against the real backend (the API branches were built in parallel), file upload end to end, and the rich-text editor in Safari.
- Next: after `feat/web-public` merges, point `setAdminAccessTokenProvider` at `getSession()` (see Requests in TASKS.md) so one refresh flow runs per tab; then check response shapes against the content, learning and payments APIs.
- Blockers / questions: none for the user.

## 2026-11-23 — frontend-student — feat/web-student

- Done: whole student cabinet under `/cabinet`: sidebar/topbar layout (mobile slide-over menu, unread bell), dashboard (overall progress, stats, last activity, my courses), my courses, course tree with module/lesson locks + progress + exam card, lesson viewer (sanitised rich text/markdown, images, files, YouTube/Vimeo/video, "material viewed" button + auto-mark, 4 practice cards, prev/next), practice player for all 5 types (MC single/multi, TRUE_FALSE, MATCHING click-to-pair + drag, FILL_BLANK inline inputs, IMAGE_BASED) with unanswered warning and graded result + explanations + retry, exam (lock reason, start/resume, server-deadline countdown with skew correction, localStorage autosave, confirm submit, auto-submit at deadline, result), results, certificates (PDF download with session, verify link, polling while the PDF is pending), payment history, notifications (filter, mark read), profile (edit name/email, change password). Typed clients `lib/api/learning.ts`, `lib/api/me.ts`; i18n in uz.json.
- Tests: 43 Vitest (question types, practice flow, exam timer/auto-submit/autosave/storage failures, lock rendering, lesson viewer, content helpers) + 15 Playwright specs x 2 viewports (`e2e/cabinet/*`, API mocked, `@smoke`), all passing. Root `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Not verified: against the real API (backends built in parallel; contract taken from the `feat/learning-api` / `feat/payments-api` shared schemas). Auth token wiring is pending (see Requests in TASKS.md): against a real API the cabinet shows the login prompt until `configureStudentAuth(authFetch…)` is added.
- Next: after merging web-public + learning/payments APIs: wire `configureStudentAuth` and `useRequireSession`, swap local types for `@onlinedars/shared`, run e2e against the seeded API.
- Blockers / questions: none.

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
