# API routes

One reference for every route, merged from the Phase 1 agents' copies (2026-11-23). The running
API also serves the full OpenAPI at `/api/docs` (JSON: `/api/docs/openapi.json`); when this file
and the code disagree, the code wins — fix this file.

## Conventions

- All routes are under `/api/v1`.
- Lists return `{ items, total, page, pageSize }` (query `page`, `pageSize` ≤ 100).
- Errors return `{ statusCode, code, message, details? }`; `code` is from
  `packages/shared/src/errors.ts` and maps to `errors.<CODE>` in `apps/web/messages/uz.json`.
- Courses have no price: access is granted only by an ADMIN (directly or by approving an access request).
- Auth: `Authorization: Bearer <accessToken>`; the refresh token is an httpOnly cookie scoped to
  `/api/v1/auth`. Roles: `ADMIN`, `CONTENT_MANAGER`, `STUDENT`, always checked on the server.
- Response types live in `packages/shared/src/schemas/` (`content.ts`, `content-admin.ts`,
  `learning.ts`, `access-requests.ts`, `platform.ts`, `catalog.ts`, `files.ts`). The web uses the same types.

## Owners

| Area                                                                                                                                   | Owner                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `/auth/*`, `/users/me*`, `/health*`                                                                                                    | architect                        |
| `/courses*`, `/directions`, `/teachers`, `/faq`, `/settings/public`, `/files/*`, admin content CRUD                                    | backend-content                  |
| `/me/*` learning, `/certificates/verify`, exams, certificate templates, dashboard, reports, `/admin/students*`                         | backend-learning                 |
| `/access-requests`, `/me/access-requests`, `/me/course-access/*`, `/admin/access-requests*`, `/admin/audit-logs`, `/me/notifications*` | backend-payments (course access) |

## Health

| Method | Path            | Notes                                  |
| ------ | --------------- | -------------------------------------- |
| GET    | `/health`       | liveness `{ status: "ok" }`            |
| GET    | `/health/ready` | readiness: `{ status, db }` (database) |

## Auth and profile

| Method | Path                    | Notes                                                                    |
| ------ | ----------------------- | ------------------------------------------------------------------------ |
| POST   | `/auth/register`        | email or phone (phone needs an OTP) → `{ accessToken, expiresIn, user }` |
| POST   | `/auth/otp/request`     | send an SMS code (console provider without Eskiz credentials)            |
| POST   | `/auth/login`           | `{ login, password }` (login = email or phone) → same as register        |
| POST   | `/auth/refresh`         | uses the refresh cookie; rotates it (reuse → `REFRESH_TOKEN_REUSED`)     |
| POST   | `/auth/logout`          | clears the refresh cookie                                                |
| GET    | `/auth/me`              | the signed-in user                                                       |
| POST   | `/auth/password/forgot` | starts a reset                                                           |
| POST   | `/auth/password/reset`  | completes a reset                                                        |
| GET    | `/users/me`             | own profile                                                              |
| PATCH  | `/users/me`             | update own profile (only the changed fields)                             |
| POST   | `/users/me/password`    | change password                                                          |

## Public (no sign-in)

| Method | Path                                    | Notes                                                                                                                                                            |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/courses`                              | published catalog. Query: `search` (or `q`), `directionId` or `direction` (slug), `teacherId`, `level`, `sort` (`newest\|popular\|title`), `page`, `pageSize`    |
| GET    | `/courses/:slugOrId`                    | course page by slug **or** id (no price)                                                                                                                         |
| GET    | `/directions`                           | active directions                                                                                                                                                |
| GET    | `/teachers`                             | active teachers                                                                                                                                                  |
| GET    | `/faq`                                  | active FAQ items                                                                                                                                                 |
| GET    | `/settings/public`                      | footer / contacts                                                                                                                                                |
| GET    | `/files/:year/:month/:name`             | uploads when the local-disk (dev) or memory (test) storage driver is active; S3 serves its own                                                                   |
| GET    | `/certificates/verify/:certificateCode` | rate-limited 60/min/IP; input normalised (case, dashes, O→0, I/L→1) → `{ certificateId, fullName, courseTitle, issuedAt, isValid }`; 404 `CERTIFICATE_NOT_FOUND` |

## Student learning (STUDENT, own data only)

| Method | Path                                   | Returns / errors                                                                                                                                                                                                             |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/me/dashboard`                        | `StudentDashboard`                                                                                                                                                                                                           |
| GET    | `/me/courses`                          | `Paginated<StudentCourseItem>` (active enrollments)                                                                                                                                                                          |
| GET    | `/me/courses/:courseId`                | `StudentCourseTree` (modules → lessons with `isLocked`, progress, exam summary, certificate). 403 `NOT_ENROLLED`                                                                                                             |
| GET    | `/me/lessons/:lessonId`                | `StudentLessonView`. 403 `NOT_ENROLLED` / `LESSON_LOCKED`, 404 unpublished                                                                                                                                                   |
| POST   | `/me/lessons/:lessonId/viewed`         | `LessonViewedResult` (idempotent, 200)                                                                                                                                                                                       |
| GET    | `/me/practices/:practiceId`            | `StudentPracticeView` — questions as `PublicQuestion` (no answers), my last 20 attempts                                                                                                                                      |
| POST   | `/me/practices/:practiceId/attempts`   | `{ answers: QuestionAnswer[] }` → `PracticeResult` (201) with per-question `isCorrect`, `correctAnswer`, `explanation`, lesson + course progress                                                                             |
| GET    | `/me/courses/:courseId/exam`           | `StudentExamStatus` (`isLocked`, `lockReason`: `LESSONS_INCOMPLETE` / `NO_EXAM` / `ATTEMPTS_EXHAUSTED` / `PASSED`)                                                                                                           |
| POST   | `/me/courses/:courseId/exam/attempts`  | `ExamAttemptView` (201): questions without answers, `expiresAt`, `serverTime`, `savedAnswers`; resumes a running attempt. 403 `EXAM_LOCKED` / `EXAM_ATTEMPTS_EXHAUSTED`, 409 `EXAM_ALREADY_PASSED`, 404 `EXAM_NOT_AVAILABLE` |
| GET    | `/me/exam-attempts/:attemptId`         | running → `ExamAttemptView`, finished → `ExamSubmitResult`                                                                                                                                                                   |
| PUT    | `/me/exam-attempts/:attemptId/answers` | autosave `{ answers }` → `{ savedAt }`. 409 `EXAM_TIME_OVER` / `EXAM_ATTEMPT_CLOSED`                                                                                                                                         |
| POST   | `/me/exam-attempts/:attemptId/submit`  | `{ answers }` → `ExamSubmitResult` (200; per-question correctness, `certificate` if passed). 409 `EXAM_TIME_OVER` (after `expiresAt` + 30 s; closed as EXPIRED from autosaved answers) / `EXAM_ATTEMPT_CLOSED`               |
| GET    | `/me/results`                          | `Paginated<StudentResultItem>` (finished exam attempts)                                                                                                                                                                      |
| GET    | `/me/certificates`                     | `Paginated<StudentCertificateItem>` (`pdfReady`, `verifyUrl`)                                                                                                                                                                |
| GET    | `/me/certificates/:id/pdf`             | `application/pdf`. 404 `CERTIFICATE_NOT_FOUND` (also for other users' certificates), 409 `CERTIFICATE_PDF_PENDING` (retry shortly)                                                                                           |

Answer shape (`QuestionAnswer`):
`{ questionId, selectedOptionIds?, matches?: [{ optionId, matchText }], blanks?: string[] }`.
`blanks[i]` answers placeholder `{{i}}` in the prompt; for MATCHING, `matchText` is one of
`matchTargets`. Correct answers are never sent before submission.

## Course access (STUDENT)

Courses are never bought or self-enrolled. A student asks; an ADMIN approves (grants the course) or
rejects (with a reason the student sees). Staff get 403 on these routes.

| Method | Path                          | Notes                                                                                                                                             |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/access-requests`            | `{ courseId, message? }` → `MyAccessRequest` (201). 409 `ALREADY_ENROLLED` / `ACCESS_REQUEST_PENDING`; 400 `COURSE_NOT_AVAILABLE` (not published) |
| GET    | `/me/access-requests`         | own requests, newest first (`MyAccessRequest[]`)                                                                                                  |
| GET    | `/me/course-access/:courseId` | `{ enrolled, request \| null }` for the course page                                                                                               |

`MyAccessRequest`: `id, courseId, courseTitle, courseSlug, status (PENDING|APPROVED|REJECTED), message,
decisionReason, decidedAt, createdAt, updatedAt`. One row per student + course: asking again after a
rejection or a revoked enrolment reopens it as `PENDING`.

## Notifications (signed in)

| Method | Path                         | Notes                                                       |
| ------ | ---------------------------- | ----------------------------------------------------------- |
| GET    | `/me/notifications`          | `?unreadOnly=true`; the response also carries `unreadCount` |
| POST   | `/me/notifications/:id/read` | mark one as read                                            |
| POST   | `/me/notifications/read-all` | mark all as read                                            |

## Admin content (ADMIN, CONTENT_MANAGER; settings ADMIN only)

| Method                        | Path                                         | Notes                                                                                                                  |
| ----------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET, POST                     | `/admin/courses`                             | list items carry `moduleCount`, `lessonCount`, `publishedLessonCount`, `enrollmentCount`                               |
| GET, PATCH, DELETE            | `/admin/courses/:id`                         | delete is refused when enrolments or certificates exist (`COURSE_NOT_DELETABLE`)                                       |
| POST                          | `/admin/courses/:id/status`                  | `{ status }` (DRAFT / PUBLISHED / HIDDEN / ARCHIVED)                                                                   |
| GET, POST                     | `/admin/courses/:id/modules`                 | modules include their `lessons`                                                                                        |
| PATCH                         | `/admin/courses/:id/modules/reorder`         | `{ ids[] }`                                                                                                            |
| PATCH, DELETE                 | `/admin/modules/:id`                         |                                                                                                                        |
| GET, POST                     | `/admin/modules/:id/lessons`                 |                                                                                                                        |
| PATCH                         | `/admin/modules/:id/lessons/reorder`         | `{ ids[] }`                                                                                                            |
| GET, PATCH, DELETE            | `/admin/lessons/:id`                         |                                                                                                                        |
| GET                           | `/admin/lessons/:id/completeness`            | `{ practices, required: 4, questionsPerPractice: [{ practiceId, questions }], ready }`                                 |
| POST                          | `/admin/lessons/:id/publish`                 | 409 `LESSON_INCOMPLETE` with the counters in `details` until 4 practices × 6 questions                                 |
| POST                          | `/admin/lessons/:id/unpublish`               |                                                                                                                        |
| GET, POST                     | `/admin/lessons/:id/materials`               | TEXT (sanitised HTML), IMAGE / FILE (uploaded url), VIDEO (YouTube / Vimeo / direct url)                               |
| PATCH                         | `/admin/lessons/:id/materials/reorder`       | `{ ids[] }`                                                                                                            |
| PATCH, DELETE                 | `/admin/materials/:id`                       |                                                                                                                        |
| GET, POST                     | `/admin/lessons/:id/practices`               | a 5th practice → 409 `LESSON_PRACTICE_LIMIT`                                                                           |
| PATCH                         | `/admin/lessons/:id/practices/reorder`       | `{ ids[] }`                                                                                                            |
| GET, PATCH, DELETE            | `/admin/practices/:id`                       | DELETE → `{ deleted, lessonUnpublished }`                                                                              |
| GET, POST                     | `/admin/practices/:id/questions`             | with correct answers; a 7th question → 409 `PRACTICE_QUESTION_LIMIT`                                                   |
| PATCH                         | `/admin/practices/:id/questions/reorder`     | `{ ids[] }`                                                                                                            |
| GET, PATCH, DELETE            | `/admin/questions/:id`                       | PATCH `options` replaces all options; DELETE → `{ deleted, lessonUnpublished }`                                        |
| POST                          | `/admin/files`                               | multipart `file` + `purpose` (`IMAGE` ≤ 5 MB jpeg/png/webp/gif, `FILE` ≤ 50 MB pdf/Office/zip/txt/csv) → `{ id, url }` |
| GET, POST; GET, PATCH, DELETE | `/admin/directions`, `/admin/directions/:id` |                                                                                                                        |
| GET, POST; GET, PATCH, DELETE | `/admin/teachers`, `/admin/teachers/:id`     |                                                                                                                        |
| GET, POST; GET, PATCH, DELETE | `/admin/faq`, `/admin/faq/:id`               |                                                                                                                        |
| GET, PATCH                    | `/admin/settings`                            | ADMIN only; changes are audit-logged                                                                                   |

## Admin learning

| Method           | Path                                                  | Roles                  | Notes                                                                                                                                     |
| ---------------- | ----------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET              | `/admin/courses/:courseId/exam`                       | ADMIN, CONTENT_MANAGER | `{ courseId, exam \| null, poolSize, poolTooSmall, attempts }`                                                                            |
| PUT              | `/admin/courses/:courseId/exam`                       | ADMIN, CONTENT_MANAGER | `examConfigSchema` (title, questionCount, timeLimitMinutes, passScore, maxAttempts?, shuffleQuestions, isActive); upsert                  |
| GET              | `/admin/courses/:courseId/exam/questions`             | ADMIN, CONTENT_MANAGER | paginated, with correct answers                                                                                                           |
| POST             | `/admin/courses/:courseId/exam/questions`             | ADMIN, CONTENT_MANAGER | `questionInputSchema`; 404 `EXAM_NOT_AVAILABLE` if the exam isn't configured yet                                                          |
| PUT              | `/admin/courses/:courseId/exam/questions/:questionId` | ADMIN, CONTENT_MANAGER | replaces question + options                                                                                                               |
| DELETE           | `/admin/courses/:courseId/exam/questions/:questionId` | ADMIN, CONTENT_MANAGER | 204                                                                                                                                       |
| GET, POST        | `/admin/certificate-templates`                        | ADMIN                  | list / create (`isDefault` clears the old default)                                                                                        |
| GET, PUT, DELETE | `/admin/certificate-templates/:id`                    | ADMIN                  |                                                                                                                                           |
| POST             | `/admin/certificate-templates/preview`                | ADMIN                  | `{ html, backgroundImageUrl? }` → `{ html }` with sample data; show in a sandboxed iframe                                                 |
| GET              | `/admin/dashboard`                                    | ADMIN, CONTENT_MANAGER | `AdminDashboardStats` (counts, `pendingAccessRequests`, `recentResults`)                                                                  |
| GET              | `/admin/reports/courses`                              | ADMIN                  | `CourseReportRow[]` (`?courseId=`)                                                                                                        |
| GET              | `/admin/reports/exams`                                | ADMIN                  | `{ from, to, items: ExamReportRow[] }` (`?from=&to=` ISO dates, default last 30 days, `?courseId=`)                                       |
| GET              | `/admin/reports/activity`                             | ADMIN                  | `{ from, to, days: ActivityReportDay[] }` (Asia/Tashkent days)                                                                            |
| GET              | `/admin/students`                                     | ADMIN                  | `Paginated<AdminStudentListItem>`; `?search=` (name / email / phone)                                                                      |
| GET              | `/admin/students/:id`                                 | ADMIN                  | `AdminStudentProfile` `{ student, enrollments (with progress), results, certificates, practiceStats }`                                    |
| POST             | `/admin/students/:id/enrollments`                     | ADMIN                  | `{ courseId, reason? }`; grant or restore access, AuditLog `ENROLLMENT_GRANTED`, closes an open request, notifies; 409 `ALREADY_ENROLLED` |
| DELETE           | `/admin/students/:id/enrollments/:courseId`           | ADMIN                  | revoke (progress kept), AuditLog `ENROLLMENT_REVOKED`; 204; 404 `NOT_ENROLLED`                                                            |

## Admin access requests and audit (ADMIN)

| Method | Path                                 | Notes                                                                                                                   |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/access-requests`             | `AdminAccessRequestList` (`items` with `student`, `decidedBy`; `pendingCount`); filters `status, courseId, search`      |
| POST   | `/admin/access-requests/:id/approve` | grants the course (source `ACCESS_REQUEST`), AuditLog `ACCESS_REQUEST_APPROVED`, notifies; 409 `ACCESS_REQUEST_DECIDED` |
| POST   | `/admin/access-requests/:id/reject`  | `{ reason ≥ 3 chars }` shown to the student, AuditLog `ACCESS_REQUEST_REJECTED`, notifies; 409 `ACCESS_REQUEST_DECIDED` |
| GET    | `/admin/audit-logs`                  | filters `entityType, entityId, actorId, action, from, to`                                                               |
