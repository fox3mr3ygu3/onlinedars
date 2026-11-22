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

## Session routine (do this every session, on any PC)
**At the start, before any edits:**
1. `git status`. If there are uncommitted changes you didn't make, stop and ask the user what they are.
2. `git fetch` then `git pull` on the current branch. If it's a feature branch, also check whether `main` moved (`git log HEAD..origin/main --oneline`) and offer to rebase.
3. Read the latest entries in `docs/HANDOFF.md` to see where the last session stopped.
4. Open your agent's section in `docs/TASKS.md` and pick the next unchecked item.
5. If you'll work on a new task, create a branch (`feat/…`, `fix/…`, `chore/…`) from up-to-date `main`. Never work on `main` directly.
6. If `package.json`, the lockfile or `prisma/` changed in the pull, run `pnpm install` and `pnpm db:migrate`.

**At the end, or when the user says they're stopping or switching PCs:**
1. Run lint + typecheck + tests for what you touched.
2. Commit with a Conventional Commit message. Unfinished work is fine as `wip: …` on the feature branch.
3. `git push`. Nothing may be left only on this PC.
4. Tick finished items in `docs/TASKS.md`.
5. Add an entry at the top of `docs/HANDOFF.md`: date, agent, branch, what was done, what's next, blockers.
6. Tell the user the branch name and whether a PR is ready to open.

The user has approved this end-of-session commit + push to feature branches ("I'm done", "switching PCs" = run it). Pushing to `main`, merging PRs, or tagging releases still needs an explicit yes.

## Git & delivery
- GitHub is the source of truth; the user works from several PCs. Pull at the start of a session and push before ending.
- Never commit directly to `main`. Use a branch (`feat/…`, `fix/…`, `chore/…`), Conventional Commits, and a PR that needs green CI. Details: `docs/GIT_WORKFLOW.md`.
- `main` auto-deploys to staging; a `v*` tag deploys to production after approval. Environments, CI/CD, backups, monitoring and scaling: `docs/DEPLOYMENT.md`.
- Never commit secrets or `.env`. Add new env vars to `.env.example`.
- Prisma migrations must be backward-compatible (expand → migrate → contract) so a rollback is safe.

@docs/STRUCTURE.md
