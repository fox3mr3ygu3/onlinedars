# Work split per agent

Each agent owns a set of paths. Edit only your own paths; if you need a change elsewhere
(e.g. a new Prisma field or shared enum), ask the **architect** agent or note it under
"Requests" at the bottom of this file. Subagent definitions live in `.claude/agents/`.

## Order of work

```
Phase 0  architect + devops  ──────►  (everything else waits for this)
         Phase 0 = foundation: repo, tooling, Docker, DB schema, auth, CI pipeline
Phase 1  backend-content │ backend-learning │ backend-payments   (parallel)
         frontend-public │ frontend-student │ frontend-admin     (parallel, against API contracts)
Phase 2  qa  (runs throughout, final acceptance at the end)
```

Frontend agents can start as soon as the architect has published the shared zod schemas and
the OpenAPI stubs — they don't need finished backend logic.

---

## 1. `architect` — foundation (Phase 0)

**Owns:** root config, `infra/`, `packages/`, `apps/api/prisma/`, `apps/api/src/{common,config,prisma}`, `apps/api/src/modules/{auth,users}`, `docs/DECISIONS.md`

- [x] pnpm + Turborepo monorepo, tsconfig/eslint packages, Husky
- [x] Docker Compose: postgres, redis, minio; `.env.example`
- [x] Scaffold `apps/web` (Next.js + Tailwind + shadcn + next-intl `uz`) and `apps/api` (NestJS + Swagger + pino + Sentry + `/health`)
- [x] Full Prisma schema (all models in the skill) + first migration + seed (admin, content manager, student, demo course with 4×6 per lesson)
- [x] `packages/shared`: enums (Role, CourseStatus, QuestionType, PaymentStatus, PaymentProvider), zod schemas for all DTOs
- [x] Auth: register/login by email or phone, argon2, OTP via Eskiz, JWT + refresh cookie, sessions, logout, password reset
- [x] Guards: `JwtAuthGuard`, `RolesGuard`, ownership/enrollment helper
- [x] Nightly `pg_dump` backup script

## 2. `backend-content` — catalog & content management API

**Owns:** `apps/api/src/modules/{courses,modules,lessons,practices,questions,directions,teachers,faq,files,settings}`

- [ ] Public read endpoints: catalog with search + filters, course detail (program, modules, lesson count, price), directions, teachers, FAQ
- [ ] Admin CRUD: courses (draft/publish/hide/archive, free/paid, price, `sequentialUnlock`), modules (reorder), lessons (materials: text/rich, images, files, optional video), practices, questions (5 types, options, correct answer, explanation)
- [ ] **4×6 invariant**: max 4 practices per lesson, max 6 questions per practice; lesson/course publish blocked until complete; endpoint returns completeness counters
- [ ] File upload to S3/MinIO with type/size limits
- [ ] Settings (platform name, general params); roles: ADMIN + CONTENT_MANAGER for content, ADMIN only for settings

## 3. `backend-learning` — progress, exams, certificates

**Owns:** `apps/api/src/modules/{progress,exams,certificates,reports,students}`, `apps/api/src/jobs/certificate-pdf*`, `apps/api/src/templates/certificate/`

- [x] Student course tree with lock state (respecting `sequentialUnlock`)
- [x] Mark material viewed; practice start/submit; **server-side grading** of all 5 question types; store attempts + answers; never leak correct answers before submit
- [x] Lesson/course progress calculation; dashboard data (courses, overall progress, last activity)
- [x] Final exam: admin config (question count, time limit, pass score); unlock after all required lessons; timed attempt; auto-grade; results history
- [x] Certificate: auto-issue on pass (once per user+course), BullMQ job renders PDF via Puppeteer from admin-managed template, unique ID, `GET /certificates/verify/:id` public
- [x] Admin reports: per-course completion, exam results, activity; admin dashboard stats
- [x] Admin students (added by coordinator): list/search, profile with progress + results, grant/revoke access (AuditLog)

## 4. `backend-payments` — orders, Payme, Click, access

**Owns:** `apps/api/src/modules/{payments,audit,notifications}`, `apps/api/src/jobs/payment-recheck*`, `apps/api/src/jobs/notify*`, `docs/api/payments.md`

- [ ] Order creation (unique orderId, amount from DB, UZS tiyin); free-course direct enrollment
- [ ] Payme Merchant API: CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction, GetStatement; Basic-auth check
- [ ] Click: Prepare + Complete endpoints with `sign_string` verification
- [ ] Idempotency (unique provider transaction id), status machine PENDING→PAID/CANCELLED/FAILED/REFUNDED, enrollment in same transaction
- [ ] Re-check job for stuck PENDING payments; refund handling per policy setting
- [ ] Student payment history; admin payment list (orderId, student, course, amount, method, date, status); restricted manual edit + AuditLog
- [ ] In-app notification on success; optional email/SMS
- [ ] Tests against provider sandbox payloads, including duplicate callbacks and amount mismatch

## 5. `frontend-public` — open site & auth

**Owns:** `apps/web/src/app/(public)`, `apps/web/src/app/(auth)`, `apps/web/src/features/{catalog,course,checkout,certificate}`, public layout

- [ ] Landing (hero, directions, recommended courses, CTAs)
- [ ] Catalog with search + filters; course card (name, short description, lesson count, price, link)
- [ ] Course page (description, goals, program/modules, lesson count, price, Buy/Start button)
- [ ] Directions, Teachers, FAQ pages
- [ ] Login / register (phone or email, OTP), forgot password
- [ ] Checkout: order summary, choose Payme or Click, redirect; return page that **polls order status** (never trusts the redirect)
- [ ] Public certificate verify page `/verify/[certificateId]`
- [ ] SEO metadata, responsive

## 6. `frontend-student` — student cabinet

**Owns:** `apps/web/src/app/(student)`, `apps/web/src/features/{lesson,practice,exam,profile}`, student layout

- [ ] Dashboard, My courses, course tree with locks and progress
- [ ] Lesson viewer (rich text, images, files, video embed) + "material viewed" tracking
- [ ] Practice player for all 5 question types (incl. drag/match, fill blank, image-based), results with explanations
- [ ] Exam: start, countdown timer, autosave, submit, result
- [ ] Results page, Certificates (list + PDF download), Payment history, Profile edit

## 7. `frontend-admin` — admin panel

**Owns:** `apps/web/src/app/(admin)`, `apps/web/src/features/admin/**`, admin layout

- [ ] Dashboard (students, active courses, completed lessons, exams, results)
- [ ] Course / module / lesson editors with drag-reorder and material upload
- [ ] Practice editor showing **"Practices 3/4", "Questions 5/6"** counters; publish button disabled until 4×6 complete
- [ ] Question editor for all 5 types (options, correct answer, explanation, image)
- [ ] Exam config, certificate template editor + preview
- [ ] Students (profile, access, progress, results), Payments (list, filters, restricted status edit with reason), Reports, Settings, Audit log
- [ ] Hide menu items by role (CONTENT_MANAGER sees content only)

## 8. `qa` — tests & acceptance

**Owns:** `e2e/`, `apps/api/test/` (CI pipeline itself belongs to `devops`)

- [ ] API e2e for every rule in `CLAUDE.md` (4×6, exam unlock, single certificate, role/ownership denial, payment idempotency, amount mismatch)
- [ ] Playwright flows = spec §13 acceptance criteria:
  1. register, login, view profile
  2. browse catalog, open course page
  3. admin creates/edits course, module, lesson
  4. exactly 4 practices × 6 questions per lesson
  5. student does practices, results saved
  6. progress calculated by rules
  7. exam unlocks after course, auto-graded
  8. pass → certificate PDF downloadable + verifiable
  9. confirmed payment grants access
  10. works on mobile (375px) and desktop
  11. student cannot access another user's data

## 9. `devops` — git, CI/CD, servers, operations

**Owns:** `.github/`, `infra/` (shared with architect in Phase 0), `docs/GIT_WORKFLOW.md`, `docs/DEPLOYMENT.md`, `CHANGELOG.md`
Starts in Phase 0 together with architect; continues through launch and maintenance.

- [ ] GitHub repo (private), branch protection on `main`, PR template, CODEOWNERS, Dependabot — template, CODEOWNERS, Dependabot done; branch protection waits on the user (`docs/USER_ACTIONS.md`)
- [x] `ci.yml`: install, lint, typecheck, unit, API e2e with Postgres/Redis services, migrate check, build, Playwright smoke
- [x] Production Dockerfiles (web, api, worker), multi-stage, non-root
- [x] `infra/docker-compose.prod.yml` + Caddy config (HTTPS)
- [x] `deploy.yml`: build → GHCR → staging on merge to `main`; production on tag `v*` with manual approval; health check; rollback by tag
- [ ] GitHub Environments `staging` / `production` with secrets
- [x] Server hardening script (firewall, SSH keys, fail2ban, unattended upgrades)
- [ ] Backups: nightly DB + MinIO off-server, pre-deploy backup, documented restore test
- [ ] Monitoring: Sentry releases, uptime checks → Telegram alerts, server metrics, log rotation
- [x] k6 load test scripts (catalog browsing, exam submit spike, payment callbacks)
- [x] Release process: changelog, semantic version tags

---

## Requests

<!-- Agents: add cross-ownership requests here, e.g. "backend-learning → architect: add Exam.shuffle Boolean" -->

- architect → backend-content: the DB triggers only block a 5th practice / 7th question and publishing an incomplete lesson. Deleting a practice or question of a **published** lesson is not blocked in the DB: unpublish the lesson in the same transaction (or refuse). Map Postgres check_violation messages starting with `LESSON_PRACTICE_LIMIT` / `PRACTICE_QUESTION_LIMIT` / `LESSON_INCOMPLETE` to AppException with the same ErrorCode.
- architect → frontend-public / frontend-student / frontend-admin: `apps/web/src/middleware.ts` (role redirects) is not written yet and has no owner in this file. The refresh cookie is httpOnly and scoped to `/api/v1/auth`, so middleware cannot read it; options: a non-sensitive `od_role` hint cookie set by the web after login, or client-side guards. The API enforces access regardless. Please decide who owns it.
- architect → qa: Phase 0 added `apps/api/test/auth.e2e-spec.ts` + `test/setup-e2e.ts` (your path) for register/login/me/refresh/logout, 401/403 and the DB 4×6 triggers. They are yours from now on.
- architect → all backend agents: use `AppException` (`apps/api/src/common/errors`) with codes from `packages/shared/src/errors.ts`; add new codes there **and** an `errors.<CODE>` entry in `apps/web/messages/uz.json` (a web unit test checks every code has a message).
- (done in Phase 0) devops → architect: root `package.json` needs `"packageManager": "pnpm@9.15.9"` (CI's pnpm/action-setup reads it; no version is pinned in the workflow).
- (done in Phase 0) devops → architect: `apps/web/next.config.*` needs `output: "standalone"` and `outputFileTracingRoot: path.join(__dirname, "../..")` (monorepo root) for `infra/docker/web.Dockerfile`; keep an `apps/web/public/` folder (copied into the image).
- (done in Phase 0) devops → architect: api build must emit `apps/api/dist/main.js` and `apps/api/dist/worker.js` (keep `prisma/seed.ts` out of the Nest tsconfig `include`, or the output moves to `dist/src/`). `prisma` must be a devDependency of apps/api (CI runs `pnpm --filter ./apps/api exec prisma migrate diff`). `pnpm db:generate` must work without `DATABASE_URL`.
- (done in Phase 0) devops → architect: add `S3_PUBLIC_URL` (public base URL for presigned links, e.g. `https://files.onlinedars.uz`) to `.env.example` and the config schema; the api should trust `X-Forwarded-For` from the proxy only (`app.set("trust proxy", 1)`).
- devops → backend-learning: launch Puppeteer with `executablePath: process.env.PUPPETEER_EXECUTABLE_PATH` and args `--no-sandbox --disable-dev-shm-usage` (worker image, non-root).
- devops → qa: put Playwright in `e2e/playwright.config.ts` with a `webServer` that starts web + api, and tag the smoke subset `@smoke` (CI runs `--grep @smoke`).
- (done) devops → backend-learning: Puppeteer launches with `PUPPETEER_EXECUTABLE_PATH` and `--no-sandbox --disable-dev-shm-usage` (`apps/api/src/modules/certificates/pdf/pdf-renderer.ts`).
- backend-learning → backend-content / coordinator: certificates use a local `CertificateStorage` interface with its own S3 impl (`modules/certificates/storage/`). When `modules/files` StorageService merges, provide `CertificateStorage` via an adapter in `CertificatesModule` and drop `@aws-sdk/client-s3` from apps/api if files already brings it.
- backend-learning → architect: `REDIS_URL` has a default in `config/env.ts`, so the API can't tell "no Redis" from config; certificates read the raw env var. Consider making `REDIS_URL` optional in the schema.
- backend-learning → backend-payments: when you grant enrollment, nothing else is needed for learning. Learning writes `Notification` rows of type `CERTIFICATE_ISSUED` (title key `certificateIssued`, body = certificate publicId, data `{ certificateId, publicId, courseId }`) and `AuditLog` rows `ENROLLMENT_GRANTED` / `ENROLLMENT_REVOKED` (entityType `Enrollment`) directly via Prisma — please keep these shapes when you build the audit/notification modules.
- backend-learning → frontend-student / frontend-admin / frontend-public: contract in `docs/api/ROUTES.md`; types in `packages/shared/src/schemas/learning.ts`. Extras beyond the coordinator contract: `GET /me/exam-attempts/:id`, `PUT /me/exam-attempts/:id/answers` (autosave), `POST /admin/certificate-templates/preview`.
- backend-learning → qa: `apps/api/test/learning.e2e-spec.ts` (your path) covers locks, grading, exam unlock/timing, single certificate, verify, ownership denial, admin reports and grant/revoke. Only ran as "skipped" locally (no Postgres) — first real run is CI.
