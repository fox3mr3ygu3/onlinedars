# OnlineDars — project context (auto-loaded every prompt)

OnlineDars is an online learning platform (modelled on mohirdev.uz UX). A student registers,
buys/joins a course, studies lessons, completes interactive practices, passes a final exam and
receives a verifiable PDF certificate. Full spec (Uzbek): `docs/SPEC_uz.txt`.

## Three parts
- **Public Panel** — landing, course catalog (search/filter), directions, course page, teachers, FAQ, auth, checkout.
- **Student Panel** — dashboard, my courses, lessons, interactive practice, exam, results, certificates (PDF), profile, payment history.
- **Admin Panel** — dashboard, courses, modules, lessons, practices, questions, exams, certificate templates, students, payments, reports, settings, audit log.

## Hard business rules (never break these)
1. Hierarchy: Course → Module → Lesson → Practice → Question.
2. **Every lesson has exactly 4 practices, every practice has exactly 6 questions (24 per lesson).** Enforce in DB/service layer AND show counters in admin UI. A lesson cannot be published unless 4×6 is complete.
3. Question types (v1): `MULTIPLE_CHOICE` (single or multi), `TRUE_FALSE`, `MATCHING`, `FILL_BLANK`, `IMAGE_BASED`.
4. Lesson complete = material viewed + required practices done. Sequential unlocking of next lesson/module is a per-course admin setting.
5. Final exam unlocks only after all required lessons are complete. Question count, time limit, pass score are admin-configured. Grading is server-side and automatic.
6. Passing the exam auto-issues a PDF certificate: full name, course name, issue date, unique certificate ID, public verify URL `/verify/{certificateId}`.
7. Roles: `ADMIN`, `CONTENT_MANAGER`, `STUDENT`. **Authorization is always checked on the server**; hiding UI is not enough. A student can only read their own data.
8. Payments (Payme, Click): access is granted **only** by a verified provider server-to-server callback — never by the browser "success" redirect. Amount/currency/order ID are validated on the server; client-sent amounts are never trusted. Callbacks are **idempotent** (one payment → access granted once). Statuses: `PENDING`, `PAID`, `CANCELLED`, `FAILED`, `REFUNDED`. Every manual admin change to a payment is written to the audit log.
9. Correct answers are never sent to the client before submission.

## Out of scope (v1)
Native mobile apps, live video/webinars, HR/ERP/warehouse/payroll, complex gamification, forum, chat.

## Conventions
- UI language: Uzbek (Latin) only in v1, but **all UI strings go through i18n** (`messages/uz.json`) — no hard-coded text.
- Code, identifiers, commits, comments: English.
- Mobile-first responsive; minimal, clean design.
- Stack, libraries and coding rules: see the `onlinedars-stack` skill (`.claude/skills/onlinedars-stack/SKILL.md`). Follow it; don't add new major dependencies without noting it in `docs/DECISIONS.md`.
- Folder layout: `docs/STRUCTURE.md` (imported below). Put files where it says.
- Work split / ownership per agent: `docs/TASKS.md`. Before starting work, find your agent's section and stay inside its owned paths.

## Git & delivery
- GitHub is the source of truth; the user works from several PCs. Pull at the start of a session and push before ending.
- Never commit directly to `main`. Use a branch (`feat/…`, `fix/…`, `chore/…`), Conventional Commits, and a PR that needs green CI. Details: `docs/GIT_WORKFLOW.md`.
- `main` auto-deploys to staging; a `v*` tag deploys to production after approval. Environments, CI/CD, backups, monitoring and scaling: `docs/DEPLOYMENT.md`.
- Never commit secrets or `.env`. Add new env vars to `.env.example`.
- Prisma migrations must be backward-compatible (expand → migrate → contract) so a rollback is safe.

@docs/STRUCTURE.md
