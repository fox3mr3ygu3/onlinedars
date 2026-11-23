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

- [x] Public read endpoints: catalog with search + filters, course detail (program, modules, lesson count, price), directions, teachers, FAQ
- [x] Admin CRUD: courses (draft/publish/hide/archive, free/paid, price, `sequentialUnlock`), modules (reorder), lessons (materials: text/rich, images, files, optional video), practices, questions (5 types, options, correct answer, explanation)
- [x] **4×6 invariant**: max 4 practices per lesson, max 6 questions per practice; lesson/course publish blocked until complete; endpoint returns completeness counters
- [x] File upload to S3/MinIO with type/size limits
- [x] Settings (platform name, general params); roles: ADMIN + CONTENT_MANAGER for content, ADMIN only for settings

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

- [x] Order creation (unique orderId, amount from DB, UZS tiyin); free-course direct enrollment
- [x] Payme Merchant API: CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction, GetStatement; Basic-auth check
- [x] Click: Prepare + Complete endpoints with `sign_string` verification
- [x] Idempotency (unique provider transaction id), status machine PENDING→PAID/CANCELLED/FAILED/REFUNDED, enrollment in same transaction
- [x] Re-check job for stuck PENDING payments; refund handling per policy setting
- [x] Student payment history; admin payment list (orderId, student, course, amount, method, date, status); restricted manual edit + AuditLog
- [x] In-app notification on success; optional email/SMS
- [x] Tests against provider sandbox payloads, including duplicate callbacks and amount mismatch

## 5. `frontend-public` — open site & auth

**Owns:** `apps/web/src/app/(public)`, `apps/web/src/app/(auth)`, `apps/web/src/features/{catalog,course,checkout,certificate,auth}`, public layout (`components/layout/public-*`), shared web auth layer `apps/web/src/lib/auth/**` + `apps/web/src/middleware.ts`, `apps/web/src/lib/api/{client,public,auth,orders}.ts`, `app/robots.ts`, `app/sitemap.ts`

- [x] Landing (hero, directions, recommended courses, CTAs)
- [x] Catalog with search + filters; course card (name, short description, lesson count, price, link)
- [x] Course page (description, goals, program/modules, lesson count, price, Buy/Start button)
- [x] Directions, Teachers, FAQ pages
- [x] Login / register (phone or email, OTP), forgot password
- [x] Checkout: order summary, choose Payme or Click, redirect; return page that **polls order status** (never trusts the redirect)
- [x] Public certificate verify page `/verify/[certificateId]`
- [x] SEO metadata, responsive

## 6. `frontend-student` — student cabinet

**Owns:** `apps/web/src/app/(student)`, `apps/web/src/features/{lesson,practice,exam,profile}`, student layout

- [x] Dashboard, My courses, course tree with locks and progress
- [x] Lesson viewer (rich text, images, files, video embed) + "material viewed" tracking
- [x] Practice player for all 5 question types (incl. drag/match, fill blank, image-based), results with explanations
- [x] Exam: start, countdown timer, autosave, submit, result
- [x] Results page, Certificates (list + PDF download), Payment history, Profile edit

## 7. `frontend-admin` — admin panel

**Owns:** `apps/web/src/app/(admin)`, `apps/web/src/features/admin/**`, admin layout

- [x] Dashboard (students, active courses, completed lessons, exams, results)
- [x] Course / module / lesson editors with drag-reorder and material upload
- [x] Practice editor showing **"Practices 3/4", "Questions 5/6"** counters; publish button disabled until 4×6 complete
- [x] Question editor for all 5 types (options, correct answer, explanation, image)
- [x] Exam config, certificate template editor + preview
- [x] Students (profile, access, progress, results), Payments (list, filters, restricted status edit with reason), Reports, Settings, Audit log
- [x] Hide menu items by role (CONTENT_MANAGER sees content only)

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
- backend-payments → backend-content: please expose the `REFUND_POLICY` setting (`"revoke"` default | `"keep"`, key/values exported from `@onlinedars/shared` as `REFUND_POLICY_SETTING_KEY` / `RefundPolicy`) in the admin settings API; payments reads it straight from the `Setting` table.
- backend-payments → frontend-public: provider return URL is `WEB_URL/checkout/{courseId}?orderId={orderId}`; when `orderId` is present, poll `GET /orders/:orderId` until `status` is `PAID` (`enrolled: true`) or `CANCELLED`/`FAILED`. `POST /orders` → discriminate on `enrolled`; 503 `PAYMENT_PROVIDER_UNAVAILABLE` means that provider has no credentials yet.
- backend-payments → frontend-admin: `PATCH /admin/payments/:orderId/status` allows only `PENDING→PAID|CANCELLED|FAILED`, `CANCELLED|FAILED→PAID`, `PAID→REFUNDED` (else 409 `INVALID_STATUS_TRANSITION`); reason ≥ 5 chars. Audit rows: `GET /admin/audit-logs?entityType=Order&entityId=…`.
- backend-payments → backend-learning: record enrollment grants/revokes with the global `AuditService.log(entry, tx)` (pass your transaction client).

- (done) devops → backend-learning: Puppeteer launches with `PUPPETEER_EXECUTABLE_PATH` and `--no-sandbox --disable-dev-shm-usage` (`apps/api/src/modules/certificates/pdf/pdf-renderer.ts`).
- backend-learning → backend-content / coordinator: certificates use a local `CertificateStorage` interface with its own S3 impl (`modules/certificates/storage/`). When `modules/files` StorageService merges, provide `CertificateStorage` via an adapter in `CertificatesModule` and drop `@aws-sdk/client-s3` from apps/api if files already brings it.
- backend-learning → architect: `REDIS_URL` has a default in `config/env.ts`, so the API can't tell "no Redis" from config; certificates read the raw env var. Consider making `REDIS_URL` optional in the schema.
- backend-learning → backend-payments: when you grant enrollment, nothing else is needed for learning. Learning writes `Notification` rows of type `CERTIFICATE_ISSUED` (title key `certificateIssued`, body = certificate publicId, data `{ certificateId, publicId, courseId }`) and `AuditLog` rows `ENROLLMENT_GRANTED` / `ENROLLMENT_REVOKED` (entityType `Enrollment`) directly via Prisma — please keep these shapes when you build the audit/notification modules.
- backend-learning → frontend-student / frontend-admin / frontend-public: contract in `docs/api/ROUTES.md`; types in `packages/shared/src/schemas/learning.ts`. Extras beyond the coordinator contract: `GET /me/exam-attempts/:id`, `PUT /me/exam-attempts/:id/answers` (autosave), `POST /admin/certificate-templates/preview`.
- backend-learning → qa: `apps/api/test/learning.e2e-spec.ts` (your path) covers locks, grading, exam unlock/timing, single certificate, verify, ownership denial, admin reports and grant/revoke. Only ran as "skipped" locally (no Postgres) — first real run is CI.

- backend-content → backend-learning: strip answers with `toPublicQuestion()` from `apps/api/src/modules/questions/question.mapper.ts` (MC/TF/IMAGE: no `isCorrect`; MATCHING: shuffled `matchTargets`; FILL_BLANK: no options, only `blankCount`; never `explanation` before submit). Show students only `isPublished` lessons. Course `HIDDEN`/`ARCHIVED` is off the public catalog but enrolled students should keep access. Deleting a lesson cascades its LessonProgress.
- backend-content → backend-payments: import `SettingsModule` and use `SettingsService.get('refundPolicy')` (`REVOKE_ACCESS` | `KEEP_ACCESS`) and `get('orderTtlMinutes')`. Only `PUBLISHED` courses should be purchasable. Course delete is refused when orders exist (FK Restrict + `COURSE_NOT_DELETABLE`).
- backend-content → frontend-admin: `DELETE /admin/practices/:id` and `/admin/questions/:id` return `{ deleted, lessonUnpublished }` — show a notice when true. `POST /admin/lessons/:id/publish` 409 `LESSON_INCOMPLETE` carries the counters in `details`. Upload with multipart field `file` + `purpose` (`IMAGE`|`FILE`), limits in `packages/shared/src/schemas/files.ts`. PATCH question `options` replaces all options. Response types: `Admin*` in `packages/shared/src/schemas/content-admin.ts`.
- backend-content → frontend-student / frontend-public: render lesson TEXT HTML through DOMPurify (server only does a regex backstop). Footer/contacts: `GET /settings/public`. Catalog accepts `search` (or `q`), `directionId` or `direction` (slug), `teacherId`, `level`, `isFree`, `sort` (`newest|popular|priceAsc|priceDesc|title`).
- backend-content → qa: added `apps/api/test/content.e2e-spec.ts` (role denial, 4×6 via HTTP + triggers, publish rules, answer stripping, uploads, settings audit). It is yours from now on; it has only run in skip mode locally (no Postgres here).
- backend-content → devops: new optional env `STORAGE_DRIVER`, `S3_REGION`, `UPLOAD_DIR` (in `.env.example`); add `S3_REGION` (and `STORAGE_DRIVER=s3`) to `infra/docker/prod.env.example`. Objects are read through `S3_PUBLIC_URL`, so the bucket needs an anonymous read policy on `uploads/*` only (certificate PDFs must stay private).

- frontend-admin → frontend-public / coordinator: after `feat/web-public` merges, wire the admin panel to the shared session so only one refresh runs per tab: in `apps/web/src/lib/api/admin/http.ts` (or the admin layout) call `setAdminAccessTokenProvider(async () => (await getSession())?.accessToken ?? null)` and use `useSession().user` in `useAdminMe` if preferred. Until then `adminFetch` does its own single-flight `POST /auth/refresh`, which can race with `@/lib/auth` and trigger `REFRESH_TOKEN_REUSED`.
- frontend-admin → backend-content: admin list endpoints may return a bare array or `{items,total,page,pageSize}` (both handled). Course responses should include `teacherIds` (or `teachers[]`), `direction{id,name}`, `lessonsCount`, `enrollmentsCount`; module `lessonsCount`; lesson `courseId` (used for the "back to course" link). `POST /admin/files` is called as multipart with fields `file` and `purpose` and must return `{url,key,mimeType,sizeBytes}`. Rich-text material/course `description` HTML comes from a contentEditable editor — sanitise it server-side. Settings keys the form knows: `platformName, supportPhone, supportEmail, supportTelegram, certificateVerifyBaseUrl, refundPolicyDays, maintenanceMode` (others are edited as JSON); `PATCH /admin/settings` receives the full object.
- frontend-admin → backend-learning: exam pool routes used: `GET/POST /admin/courses/:courseId/exam/questions`, `PATCH/DELETE /admin/courses/:courseId/exam/questions/:id`; `GET /admin/courses/:id/exam` → 404 when not configured. Dashboard fields: `students, activeCourses, completedLessons, examsTaken, examsPassed` (+ optional `certificatesIssued, revenue, recentPayments`). Reports rows: courses `{courseId,courseTitle,enrolled,completed,completionRate}`, exams `{courseId,courseTitle,attempts,passed,averageScore}`, activity `{date,activeStudents,lessonsCompleted,practicesSubmitted}`; all accept `from`/`to` ISO. Student detail: `enrollments[{courseId,courseTitle,source,enrolledAt,completedAt,revokedAt,progressPercent}]`, `results[{id,kind:'PRACTICE'|'EXAM',title,courseTitle,scorePercent,passed,submittedAt}]`, optional `certificates[{id,publicId,courseTitle,issuedAt}]`. Certificate template placeholders: see DECISIONS (2026-11-23).
- frontend-admin → backend-payments: `GET /admin/payments` rows used: `{id, orderId, orderNumber?, student{id,fullName,phone?,email?}, course{id,title}, amount, currency, provider, status, createdAt, paidAt}`; `from`/`to` are ISO datetimes. `GET /admin/audit-logs` accepts `action, entityType, from, to, page, pageSize` and rows `{id, actor{id,fullName}|null, action, entityType, entityId, before, after, reason, ip, createdAt}`.
- frontend-admin → qa: added `e2e/playwright.config.ts` (web only, API mocked per spec) and `e2e/admin/*.spec.ts` (tagged `@smoke`); merge with your config as needed. Specs set the `od_role` cookie so frontend-public's middleware lets `/admin` through.

- frontend-student → coordinator/frontend-public: the cabinet calls the API through `configureStudentAuth()` in `apps/web/src/lib/api/student-fetch.ts` (default: plain `apiFetch`, no token). After merging `feat/web-public`, wire it once, e.g. in `CabinetShell`: `configureStudentAuth({ fetch: authFetch, getAccessToken: async () => (await getSession())?.accessToken ?? null })`, and call `useRequireSession(['STUDENT'])` there. Until then every cabinet call returns 401 against a real API (the UI shows a login prompt).
- frontend-student → backend-learning / backend-payments: `apps/web/src/lib/api/learning-types.ts` and the `MyOrder` / `MyNotification` types in `apps/web/src/lib/api/me.ts` are copies of your shared contracts (`schemas/learning.ts`, `schemas/payments.ts`). After merge, replace them with imports from `@onlinedars/shared`. `GET /me/certificates/:id/pdf` may return either PDF bytes or JSON `{ url }` (presigned) — the web handles both. Exam autosave is local only (localStorage); no server autosave endpoint is called.
- frontend-student → architect: `FormMessage`'s `translate` prop (`apps/web/src/components/ui/form.tsx`) clashes with the HTML `translate="yes|no"` attribute type, so passing a function needs a cast. Please rename it (e.g. `translateMessage`).
- frontend-student → architect: added web devDeps (`@testing-library/{react,dom,user-event,jest-dom}`, `jsdom`), dep `dompurify`, and root devDep `@playwright/test` (CI runs `pnpm exec playwright` from the root). `apps/web/vitest.config.mts` now has `unit` (node) + `dom` (jsdom, `*.spec.tsx`) projects.
- frontend-student → qa: created `e2e/playwright.config.ts` (web-only `webServer` via `next start`, mobile 375 + desktop 1280 projects) and `e2e/cabinet/*.spec.ts` (API mocked with `page.route`, all `@smoke`). Merge/extend as you like (e.g. add the API to `webServer` for full-stack flows).
- frontend-student → coordinator: `uz.json` — added keys inside the existing `cabinet` object and new namespaces `lesson, practice, exam, results, certificates, payments, notifications, profile` appended after `errors`.

- (done) frontend-public: owns `apps/web/src/middleware.ts` + `src/lib/auth/**` (coordinator decision). Auth layer API is documented at the top of `apps/web/src/lib/auth/index.ts`. Cabinet/admin layouts: use `useRequireSession(['STUDENT'])` / `useRequireSession(STAFF_ROLES)` and `authFetch` for API calls.
- frontend-public → backend-content: the web sends both `search` and `q` to `GET /courses` (shared `catalogQuerySchema` uses `q`; the coordinator's contract said `search`). Pick one and tell us. Course cards need `lessonCount` (and ideally `moduleCount`, `direction {id,slug,name}`); course detail needs `description, goals[], modules[{id,title,description,lessons[{id,title,durationMinutes}]}], teachers[{id,slug,fullName,title,photoUrl}]`. `GET /courses/:slugOrId` should also resolve by id (checkout falls back to the id when no slug is in the URL). Directions may include `courseCount`. Lists as `{items,total,page,pageSize}` (bare arrays also accepted).
- frontend-public → architect: please add response zod schemas for the public catalog (course card/detail, direction, teacher, faq) and the `POST /orders` response to `packages/shared`; the web uses local types in `apps/web/src/lib/api/{public,orders}.ts` with TODOs. Also `NEXT_PUBLIC_SITE_URL` (absolute site origin for canonical URLs, Open Graph and the sitemap; default `http://localhost:3000`) → `.env.example`.
- frontend-public → backend-payments: the web needs `errors.PAYMENT_PROVIDER_UNAVAILABLE` in `uz.json` (your branch adds the code; frontend-public did not add it to avoid a merge conflict in the `errors` namespace). Until then the generic error is shown. The free-course call still sends `provider: 'PAYME'` (the server ignores it for free courses).
- frontend-public → qa: `e2e/playwright.config.ts` and `e2e/public/*` were created by frontend-public (yours from now on). `@playwright/test` is a root devDependency. Smoke specs mock the API with `page.route`; server-rendered data pages need the real API (CI starts it with test-only JWT secrets from the config). Locally: `pnpm build` then `E2E_PROD=1 pnpm exec playwright test --config e2e/playwright.config.ts --grep @smoke` (`next dev` compiles too slowly for the default timeouts on this PC).
- frontend-public → frontend-student: payment-success links go to `/cabinet/courses/{courseId}` and `/cabinet/payments`; please keep those routes.
