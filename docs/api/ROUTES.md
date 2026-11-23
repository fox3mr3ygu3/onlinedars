# API route contract (Phase 1)

Agreed by the coordinator for the parallel backend/frontend agents. All under `/api/v1`;
lists return `{items, total, page, pageSize}`; errors `{code, message}` (plus `statusCode`).

## Payments (backend-payments)

- `POST /orders` `{courseId, provider: "PAYME"|"CLICK"}` → `{orderId, number, amount, redirectUrl}` (free course → `{enrolled: true}`)
- `GET /orders/:orderId` (own; the web polls status)
- `GET /me/orders`
- `POST /payments/payme` (JSON-RPC)
- `POST /payments/click/prepare`
- `POST /payments/click/complete`
- `GET /admin/payments?status=&provider=&courseId=&search=&from=&to=`
- `PATCH /admin/payments/:id/status` `{status, reason}` (ADMIN)
- `GET /admin/audit-logs`
- `GET /me/notifications`
- `POST /me/notifications/:id/read`

Others own `/courses*`, `/admin` content CRUD, `/me/*` learning routes and `/admin/students*`.
backend-learning writes AuditLog rows for enrollment grants/revokes through the exported
`AuditService` (`apps/api/src/modules/audit/audit.service.ts`, global module).

### Implementation notes (backend-payments, all additive to the contract)

- `POST /orders` paid response also has `enrolled: false`, `currency`, `provider`, `status`;
  free response is `{enrolled: true, courseId}`. Discriminate on `enrolled`. Zod:
  `createOrderResponseSchema` in `packages/shared/src/schemas/payments.ts`.
- Provider return URL: `WEB_URL/checkout/{courseId}?orderId={orderId}` — the checkout page
  should poll `GET /orders/:orderId` when `orderId` is in the query.
- `GET /orders/:orderId` and `/me/orders` items: `orderSchema` (`orderId, number, status,
courseId, courseTitle, courseSlug, amount, currency, provider, enrolled, paidAt, cancelledAt,
expiresAt, createdAt`).
- `GET /admin/payments` also accepts `userId`, `minAmount`, `maxAmount` (tiyin), `page`,
  `pageSize`; one row per order with `student` and `transactions[]`. `:id` in the PATCH is the
  **orderId**. Allowed transitions and audit details: `docs/api/payments.md`.
- `GET /admin/audit-logs` filters: `entityType, entityId, actorId, action, from, to`.
- `GET /me/notifications?unreadOnly=true` returns `unreadCount` too; extra
  `POST /me/notifications/read-all`.

All under `/api/v1`. Lists return `{ items, total, page, pageSize }` (query `page`, `pageSize` ≤ 100).
Errors return `{ statusCode, code, message, details? }`; `code` maps to `errors.<CODE>` in `apps/web/messages/uz.json`.
Response types live in `packages/shared/src/schemas/learning.ts` (learning) and `content.ts`.

## Owners

- **backend-learning**: everything in the sections below.
- Others: `/courses*`, `/directions`, `/teachers`, `/faq`, admin content CRUD (backend-content);
  `/orders*`, `/payments/*`, `/admin/payments*`, `/admin/audit-logs`, `/me/orders`, `/me/notifications*` (backend-payments).

## Public

| Method | Path                                    | Notes                                                                                                                                                                                                |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/certificates/verify/:certificateCode` | `@Public`, rate-limited 60/min/IP. Input is normalised (case, dashes, O→0, I/L→1). → `CertificateVerify` `{ certificateId, fullName, courseTitle, issuedAt, isValid }`; 404 `CERTIFICATE_NOT_FOUND`. |

## Student learning (role STUDENT, own data only)

| Method | Path                                   | Returns / errors                                                                                                                                                                                                                    |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/me/dashboard`                        | `StudentDashboard`                                                                                                                                                                                                                  |
| GET    | `/me/courses`                          | `Paginated<StudentCourseItem>` (active enrollments)                                                                                                                                                                                 |
| GET    | `/me/courses/:courseId`                | `StudentCourseTree` (modules → lessons with `isLocked`, progress, exam summary, certificate). 403 `NOT_ENROLLED`                                                                                                                    |
| GET    | `/me/lessons/:lessonId`                | `StudentLessonView`. 403 `NOT_ENROLLED` / `LESSON_LOCKED`, 404 unpublished                                                                                                                                                          |
| POST   | `/me/lessons/:lessonId/viewed`         | `LessonViewedResult` (idempotent, 200)                                                                                                                                                                                              |
| GET    | `/me/practices/:practiceId`            | `StudentPracticeView` — questions as `PublicQuestion` (no answers), my last 20 attempts                                                                                                                                             |
| POST   | `/me/practices/:practiceId/attempts`   | body `{ answers: QuestionAnswer[] }` → `PracticeResult` (201) with per-question `isCorrect`, `correctAnswer`, `explanation`, lesson + course progress                                                                               |
| GET    | `/me/courses/:courseId/exam`           | `StudentExamStatus` (`isLocked`, `lockReason`: `LESSONS_INCOMPLETE`/`NO_EXAM`/`ATTEMPTS_EXHAUSTED`/`PASSED`)                                                                                                                        |
| POST   | `/me/courses/:courseId/exam/attempts`  | `ExamAttemptView` (201): questions without answers, `expiresAt`, `serverTime`, `savedAnswers`. Resumes a running attempt. 403 `EXAM_LOCKED` / `EXAM_ATTEMPTS_EXHAUSTED`, 409 `EXAM_ALREADY_PASSED`, 404 `EXAM_NOT_AVAILABLE`        |
| GET    | `/me/exam-attempts/:attemptId`         | _(extra)_ running → `ExamAttemptView`, finished → `ExamSubmitResult`                                                                                                                                                                |
| PUT    | `/me/exam-attempts/:attemptId/answers` | _(extra)_ autosave `{ answers }` → `{ savedAt }`. 409 `EXAM_TIME_OVER` / `EXAM_ATTEMPT_CLOSED`                                                                                                                                      |
| POST   | `/me/exam-attempts/:attemptId/submit`  | body `{ answers }` → `ExamSubmitResult` (200; per-question correctness only, `certificate` if passed). 409 `EXAM_TIME_OVER` (after `expiresAt` + 30 s; attempt closed as EXPIRED from autosaved answers), 409 `EXAM_ATTEMPT_CLOSED` |
| GET    | `/me/results`                          | `Paginated<StudentResultItem>` (finished exam attempts)                                                                                                                                                                             |
| GET    | `/me/certificates`                     | `Paginated<StudentCertificateItem>` (`pdfReady`, `verifyUrl`)                                                                                                                                                                       |
| GET    | `/me/certificates/:id/pdf`             | `application/pdf` attachment. 404 `CERTIFICATE_NOT_FOUND` (also for other users' certificates), 409 `CERTIFICATE_PDF_PENDING` (retry in a few seconds)                                                                              |

Answer shape (`QuestionAnswer`): `{ questionId, selectedOptionIds? , matches?: [{ optionId, matchText }], blanks?: string[] }`.
`blanks[i]` is the answer for placeholder `{{i}}` in the prompt. MATCHING: `matchText` is one of `matchTargets`.

## Admin learning

| Method         | Path                                                  | Roles                  | Notes                                                                                                                         |
| -------------- | ----------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET            | `/admin/courses/:courseId/exam`                       | ADMIN, CONTENT_MANAGER | `{ courseId, exam \| null, poolSize, poolTooSmall, attempts }`                                                                |
| PUT            | `/admin/courses/:courseId/exam`                       | ADMIN, CONTENT_MANAGER | body `examConfigSchema` (title, questionCount, timeLimitMinutes, passScore, maxAttempts?, shuffleQuestions, isActive); upsert |
| GET            | `/admin/courses/:courseId/exam/questions`             | ADMIN, CONTENT_MANAGER | paginated, with correct answers                                                                                               |
| POST           | `/admin/courses/:courseId/exam/questions`             | ADMIN, CONTENT_MANAGER | body `questionInputSchema`; 404 `EXAM_NOT_AVAILABLE` if the exam isn't configured yet                                         |
| PUT            | `/admin/courses/:courseId/exam/questions/:questionId` | ADMIN, CONTENT_MANAGER | replaces question + options                                                                                                   |
| DELETE         | `/admin/courses/:courseId/exam/questions/:questionId` | ADMIN, CONTENT_MANAGER | 204                                                                                                                           |
| GET/POST       | `/admin/certificate-templates`                        | ADMIN                  | list (paginated) / create (`certificateTemplateInputSchema`; `isDefault` clears the old default)                              |
| GET/PUT/DELETE | `/admin/certificate-templates/:id`                    | ADMIN                  |                                                                                                                               |
| POST           | `/admin/certificate-templates/preview`                | ADMIN                  | _(extra)_ `{ html, backgroundImageUrl? }` → `{ html }` with sample data; show in a sandboxed iframe                           |
| GET            | `/admin/dashboard`                                    | ADMIN                  | `AdminDashboardStats`                                                                                                         |
| GET            | `/admin/reports/courses`                              | ADMIN                  | `CourseReportRow[]` (`?courseId=`)                                                                                            |
| GET            | `/admin/reports/exams`                                | ADMIN                  | `{ from, to, items: ExamReportRow[] }` (`?from=&to=` ISO dates, default last 30 days, `?courseId=`)                           |
| GET            | `/admin/reports/activity`                             | ADMIN                  | `{ from, to, days: ActivityReportDay[] }` (Asia/Tashkent days)                                                                |
| GET            | `/admin/students?search=`                             | ADMIN                  | `Paginated<AdminStudentListItem>` (name / email / phone)                                                                      |
| GET            | `/admin/students/:id`                                 | ADMIN                  | `AdminStudentProfile` (profile, enrollments + progress, results, certificates, practice stats)                                |
| POST           | `/admin/students/:id/enrollments`                     | ADMIN                  | body `{ courseId, reason? }`; grant or restore access, AuditLog `ENROLLMENT_GRANTED`; 409 `ALREADY_ENROLLED`                  |
| DELETE         | `/admin/students/:id/enrollments/:courseId`           | ADMIN                  | revoke (progress kept), AuditLog `ENROLLMENT_REVOKED`; 204; 404 `NOT_ENROLLED`                                                |

# API route contract

All routes are under `/api/v1`. Lists return `{ items, total, page, pageSize }`; errors return `{ code, message }` (see `packages/shared/src/errors.ts`).

## Public (`@Public`)

- `GET /courses?search=&directionId=&isFree=&page=&pageSize=`
- `GET /courses/:slug`
- `GET /directions`
- `GET /teachers`
- `GET /faq`
- `GET /certificates/verify/:certificateCode`

## Admin content — backend-content (ADMIN, CONTENT_MANAGER)

- `/admin/courses` (GET, POST)
- `/admin/courses/:id` (GET, PATCH, DELETE)
- `POST /admin/courses/:id/status` `{ status }`
- `/admin/courses/:id/modules` (GET, POST)
- `PATCH /admin/courses/:id/modules/reorder` `{ ids[] }`
- `/admin/modules/:id` (PATCH, DELETE)
- `/admin/modules/:id/lessons` (GET, POST)
- `PATCH /admin/modules/:id/lessons/reorder`
- `/admin/lessons/:id` (GET, PATCH, DELETE)
- `/admin/lessons/:id/materials` (GET, POST)
- `/admin/materials/:id` (PATCH, DELETE)
- `GET /admin/lessons/:id/completeness` → `{ practices: n, required: 4, questionsPerPractice: [...], ready: boolean }`
- `POST /admin/lessons/:id/publish`
- `POST /admin/lessons/:id/unpublish`
- `/admin/lessons/:id/practices` (GET, POST)
- `/admin/practices/:id` (GET, PATCH, DELETE)
- `/admin/practices/:id/questions` (GET, POST)
- `/admin/questions/:id` (PATCH, DELETE)
- `POST /admin/files` (multipart) → `{ id, url }`
- `/admin/directions`, `/admin/teachers`, `/admin/faq` (CRUD)
- `GET/PATCH /admin/settings` (ADMIN only)

## Owned by other agents

`/me/*`, `/admin/courses/:id/exam*`, `/admin/certificate-templates`, `/admin/dashboard`, `/admin/reports/*`, `/admin/students*`, `/orders*`, `/payments/*`, `/admin/payments*`, `/admin/audit-logs`, `/me/notifications*`.
