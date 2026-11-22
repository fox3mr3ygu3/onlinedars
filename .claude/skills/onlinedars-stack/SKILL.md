---
name: onlinedars-stack
description: Tech stack, libraries and coding conventions for the OnlineDars learning platform. Use whenever writing, reviewing or scaffolding any code in this repo (frontend, backend, database, payments Payme/Click, PDF certificates, auth, tests, Docker) so every agent uses the same tools and patterns.
---

# OnlineDars — stack & conventions

The spec leaves the stack to the dev team. This is the agreed stack. If you must deviate, record why in `docs/DECISIONS.md`.

## Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict) everywhere |
| Frontend | Next.js 15 (App Router, Server Components), React 19 |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react icons |
| Forms / validation | react-hook-form + zod (schemas shared from `packages/shared`) |
| Data fetching (client) | TanStack Query v5 |
| i18n | next-intl, default locale `uz`, messages in `apps/web/messages/uz.json` |
| Backend API | NestJS 11 (REST, `/api/v1`), OpenAPI via `@nestjs/swagger` |
| ORM / DB | Prisma + PostgreSQL 16 |
| Cache / queues | Redis + BullMQ (certificate PDF jobs, notifications, payment re-checks) |
| File storage | S3-compatible (MinIO locally) — lesson files, images, certificate PDFs |
| Auth | Email or phone + password (argon2), phone OTP via Eskiz.uz SMS; JWT access (15 min) + rotating refresh token in httpOnly cookie; sessions table for revoke |
| PDF | Puppeteer rendering an HTML certificate template → stored in S3 |
| Payments | Payme (Merchant API, JSON-RPC) and Click (Prepare/Complete) — server-side only |
| Logging / monitoring | pino (nestjs-pino), Sentry for web + api, `/health` endpoint |
| Tests | Vitest (unit), Supertest (api e2e), Playwright (web e2e) |
| Lint / format | ESLint + Prettier, Husky + lint-staged |
| Infra | Docker Compose (postgres, redis, minio, api, web, worker); Caddy for HTTPS; nightly `pg_dump` backup copied off-server |
| VCS / CI / CD | GitHub (private repo), GitHub Actions, images in GHCR, SSH deploy to staging (on merge to `main`) and production (on tag `v*`) |
| Monitoring | Sentry, uptime checks with Telegram alerts, k6 load tests |

## Coding rules

**Backend (NestJS)**
- One Nest module per domain: `auth, users, courses, modules, lessons, practices, questions, progress, exams, certificates, payments, reports, settings, audit, files`.
- Controller → Service → Prisma. No Prisma calls in controllers.
- Every route has guards: `JwtAuthGuard` + `RolesGuard` with `@Roles(...)`. Student routes additionally check ownership (`userId === req.user.id`) or enrollment.
- DTOs validated with zod (`nestjs-zod`) using schemas from `packages/shared`.
- Business invariants live in services and are covered by unit tests:
  - lesson publish requires exactly 4 practices × 6 questions;
  - exam unlock requires all required lessons complete;
  - certificate issued once per (user, course) when score ≥ passScore.
- Grading happens only on the server. Endpoints that return questions to students strip `isCorrect`, correct pairs and blank answers.
- Money: store as integer **tiyin** (`amount` BigInt/Int), currency `UZS`. Never trust client amount.
- Payment callbacks: verify signature/auth (Payme Basic auth with merchant key; Click `sign_string` MD5), look up order by our `orderId`, compare amount, run status change + enrollment inside one DB transaction, guard idempotency with unique `(provider, providerTransactionId)`. Return provider-specific error codes exactly as their docs require.
- Admin manual payment/status edits → `AuditLog` row (actor, action, entity, before, after, timestamp).
- Errors: throw Nest HTTP exceptions with a stable `code` string; the web maps codes to i18n messages.

**Frontend (Next.js)**
- Route groups: `(public)`, `(student)` under `/cabinet`, `(admin)` under `/admin`. Middleware redirects by role; the API still enforces it.
- Prefer Server Components for pages; client components only for interactivity (practice player, forms).
- API calls go through the typed client in `apps/web/src/lib/api` (generated from OpenAPI or hand-written with shared zod types).
- No hard-coded user-visible strings — use `useTranslations()` / `getTranslations()`.
- Mobile-first; test at 375px, 768px, 1280px.
- Reuse shadcn components in `apps/web/src/components/ui`; feature components in `src/features/<domain>`.

**Database (Prisma)**
- Core models: `User, Session, Course, Direction, Teacher, Module, Lesson, LessonMaterial, Practice, Question, QuestionOption, Enrollment, LessonProgress, PracticeAttempt, PracticeAnswer, Exam, ExamQuestion, ExamAttempt, Certificate, CertificateTemplate, Order, Payment, AuditLog, Setting, Faq`.
- Ordering fields: `position Int` on Module/Lesson/Practice/Question.
- Course status enum: `DRAFT, PUBLISHED, HIDDEN, ARCHIVED`. `isFree Boolean`, `price Int` (tiyin), `sequentialUnlock Boolean`.
- Every schema change = a Prisma migration committed with the code. Seed script creates an admin, a content manager, a student and one complete demo course (4×6 per lesson).

**General**
- Conventional commits (`feat(payments): ...`).
- Secrets only in `.env` (never committed); keep `.env.example` updated.
- Write tests for every business rule listed in `CLAUDE.md`.
