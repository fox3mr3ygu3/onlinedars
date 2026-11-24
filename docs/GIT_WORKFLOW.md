# Git workflow

## Where the code lives

- Source of truth: the **private GitHub repo**. Every PC clones it.
- Clone it into a folder that is **not** synced by OneDrive, Dropbox or Google Drive. Recommended: `C:\dev\onlinedars`.
  Cloud-sync tools fight with git and try to upload `node_modules`.
- Use the same path, `C:\dev\onlinedars`, on every PC so docs and scripts work everywhere. Keep OneDrive for personal files only.

## Setting up a new PC

1. Install Git, Node.js LTS, pnpm (`corepack enable`), Docker Desktop and the GitHub CLI (`gh`).
2. Run `gh auth login` and sign in in the browser. Never paste tokens into files or chat.
3. Run `git clone https://github.com/<owner>/onlinedars.git C:\dev\onlinedars`.
4. Run `cp .env.example .env` and fill in the values from your password manager.
5. Run `pnpm install`, `pnpm docker:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`.
   Optional: `pnpm db:seed:demo` fills every page with realistic demo data (10 courses, 30 students
   `talaba01…30@demo.onlinedars.uz`, orders in every status, certificates, reports). Dev/staging only.
   If port 5432 is taken by a local PostgreSQL, set `POSTGRES_PORT=5433` in `.env` and use 5433 in `DATABASE_URL`.

## Daily routine on any PC

1. **Start:** `git switch main`, `git pull`. Then create a branch or switch back to yours.
2. **Work** in small commits.
3. **Stop:** `git push`, even when the work is unfinished (WIP commits on your branch are fine).
   This is how you continue on another PC. Nothing should exist only on one machine.

## Branches

| Branch                | Purpose                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `main`                | Always deployable. Protected: changes only through a Pull Request with green CI. Auto-deploys to **staging**. |
| `feat/<area>-<short>` | New feature, e.g. `feat/access-requests`                                                                      |
| `fix/<short>`         | Bug fix                                                                                                       |
| `chore/<short>`       | Tooling, dependencies, docs                                                                                   |
| `hotfix/<short>`      | Urgent production fix, branched from the latest release tag                                                   |

**Releases:** tag `main` as `vMAJOR.MINOR.PATCH` (e.g. `v1.2.0`). Pushing the tag deploys to **production** after manual approval.

## Release process

1. Make sure `main` is green and staging has been checked (it auto-deploys on every merge).
2. Pick the version (SemVer): breaking change → MAJOR, new feature → MINOR, fixes only → PATCH.
3. In a `chore/release-vX.Y.Z` PR, move the `CHANGELOG.md` "Unreleased" items under `## [X.Y.Z] - YYYY-MM-DD`. Squash-merge it.
4. Tag the merge commit and push the tag (needs the user's explicit yes):
   `git switch main && git pull && git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
5. Approve the `production` deployment in GitHub Actions. Check the site and `/api/v1/health`.
6. Hotfix: branch `hotfix/<short>` from the release tag, PR into `main`, then tag `vX.Y.Z+1`.
7. Rollback: Actions → Deploy → _Run workflow_ with the previous tag (see `docs/DEPLOYMENT.md`).

## Commits

- Use Conventional Commits: `feat(lessons): enforce 4x6 before publish`, `fix(access): reject a second pending request`.
- Each commit should build. Never commit `.env`, keys, database dumps or `node_modules`.

## Pull Requests

- One PR per task or feature, kept small (ideally under 400 changed lines).
- The PR description says what changed, how it was tested, and any schema migration or env var it adds.
- To merge, CI must be green: lint, typecheck, unit, API e2e, build, and Playwright smoke.
  Required status checks for branch protection (job names in `.github/workflows/ci.yml`):
  `Lint + typecheck`, `Unit tests`, `API e2e + migrations`, `Build`, `Playwright smoke`, `Docker image (web)`, `Docker image (api)`, `Docker image (worker)`.
- Merge by squash.

## Parallel agents

- Each agent works on its **own branch**, ideally in its own git worktree, and edits only its owned paths (`docs/TASKS.md`).
- Schema or shared-type changes go through the `architect` agent first. Other branches then rebase on `main`.
- Prisma migration conflicts: rebase, delete your unmerged migration, and recreate it with `prisma migrate dev`.

## Secrets

- `.env` is in `.gitignore`. `.env.example` lists every variable with dummy values; keep it updated.
- Real values live in a password manager (for people) and in **GitHub Environments → Secrets** (for CI/CD).
- If a secret is ever committed, **rotate it immediately**. Deleting the commit is not enough.

## Claude across PCs

- `CLAUDE.md`, `.claude/skills`, `.claude/agents` and `.claude/settings.json` are committed, so every PC gets them.
- `.claude/settings.local.json` and Claude's personal memory (`~/.claude/`) stay per-PC.
  Anything every PC must know goes into the repo docs.
