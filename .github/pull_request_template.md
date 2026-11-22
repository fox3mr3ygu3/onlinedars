## What changed
<!-- One or two sentences. Link the TASKS.md item or issue. -->

## Why

## How it was tested
- [ ] `pnpm lint` and `pnpm typecheck`
- [ ] `pnpm test` (unit)
- [ ] `pnpm test:e2e` (API e2e) or CI
- [ ] Checked in the browser at 375px / 768px / 1280px (UI changes)

## Checklist
- [ ] Stays inside my agent's owned paths (`docs/TASKS.md`), or the request is noted there
- [ ] Business rules from `CLAUDE.md` still hold (4x6, server-side auth/grading, payment callbacks only)
- [ ] No secrets, `.env` or dumps committed; new env vars added to `.env.example`
- [ ] New UI text is in `apps/web/messages/uz.json`
- [ ] Prisma migration included and backward-compatible (expand -> migrate -> contract)
- [ ] `CHANGELOG.md` "Unreleased" updated for user-visible changes

## Migrations / env vars / deploy notes
<!-- "None" if nothing. -->
