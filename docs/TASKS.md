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
- [ ] pnpm + Turborepo monorepo, tsconfig/eslint packages, Husky
- [ ] Docker Compose: postgres, redis, minio; `.env.example`
- [ ] Scaffold `apps/web` (Next.js + Tailwind + shadcn + next-intl `uz`) and `apps/api` (NestJS + Swagger + pino + Sentry + `/health`)
- [ ] Full Prisma schema (all models in the skill) + first migration + seed (admin, content manager, student, demo course with 4×6 per lesson)
- [ ] `packages/shared`: enums (Role, CourseStatus, QuestionType, PaymentStatus, PaymentProvider), zod schemas for all DTOs
- [ ] Auth: register/login by email or phone, argon2, OTP via Eskiz, JWT + refresh cookie, sessions, logout, password reset
- [ ] Guards: `JwtAuthGuard`, `RolesGuard`, ownership/enrollment helper
- [ ] Nightly `pg_dump` backup script

## 2. `backend-content` — catalog & content management API
**Owns:** `apps/api/src/modules/{courses,modules,lessons,practices,questions,directions,teachers,faq,files,settings}`
- [ ] Public read endpoints: catalog with search + filters, course detail (program, modules, lesson count, price), directions, teachers, FAQ
- [ ] Admin CRUD: courses (draft/publish/hide/archive, free/paid, price, `sequentialUnlock`), modules (reorder), lessons (materials: text/rich, images, files, optional video), practices, questions (5 types, options, correct answer, explanation)
- [ ] **4×6 invariant**: max 4 practices per lesson, max 6 questions per practice; lesson/course publish blocked until complete; endpoint returns completeness counters
- [ ] File upload to S3/MinIO with type/size limits
- [ ] Settings (platform name, general params); roles: ADMIN + CONTENT_MANAGER for content, ADMIN only for settings

## 3. `backend-learning` — progress, exams, certificates
**Owns:** `apps/api/src/modules/{progress,exams,certificates,reports}`, `apps/api/src/jobs/certificate-pdf*`, `apps/api/src/templates/certificate/`
- [ ] Student course tree with lock state (respecting `sequentialUnlock`)
- [ ] Mark material viewed; practice start/submit; **server-side grading** of all 5 question types; store attempts + answers; never leak correct answers before submit
- [ ] Lesson/course progress calculation; dashboard data (courses, overall progress, last activity)
- [ ] Final exam: admin config (question count, time limit, pass score); unlock after all required lessons; timed attempt; auto-grade; results history
- [ ] Certificate: auto-issue on pass (once per user+course), BullMQ job renders PDF via Puppeteer from admin-managed template, unique ID, `GET /certificates/verify/:id` public
- [ ] Admin reports: per-course completion, exam results, activity; admin dashboard stats

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
- [ ] GitHub repo (private), branch protection on `main`, PR template, CODEOWNERS, Dependabot
- [ ] `ci.yml`: install, lint, typecheck, unit, API e2e with Postgres/Redis services, migrate check, build, Playwright smoke
- [ ] Production Dockerfiles (web, api, worker), multi-stage, non-root
- [ ] `infra/docker-compose.prod.yml` + Caddy config (HTTPS)
- [ ] `deploy.yml`: build → GHCR → staging on merge to `main`; production on tag `v*` with manual approval; health check; rollback by tag
- [ ] GitHub Environments `staging` / `production` with secrets
- [ ] Server hardening script (firewall, SSH keys, fail2ban, unattended upgrades)
- [ ] Backups: nightly DB + MinIO off-server, pre-deploy backup, documented restore test
- [ ] Monitoring: Sentry releases, uptime checks → Telegram alerts, server metrics, log rotation
- [ ] k6 load test scripts (catalog browsing, exam submit spike, payment callbacks)
- [ ] Release process: changelog, semantic version tags

---

## Requests
<!-- Agents: add cross-ownership requests here, e.g. "backend-learning → architect: add Exam.shuffle Boolean" -->
