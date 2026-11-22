# Waiting on you (the user)

Agents add items here when something needs a human decision, a credential, or an admin action.
They keep working on everything else and mock or stub what's blocked. Tick an item when it's done.

## Credentials & accounts (agents use mocks/test stubs until these exist)

- [ ] **Payme** merchant ID + test key (sandbox), then live key → GitHub Environment secrets, never in files
- [ ] **Click** service ID, merchant ID, secret key (test, then live)
- [ ] **Eskiz.uz** SMS account (email + password/token) for phone OTP
- [ ] **Sentry** project DSNs (web + api), optional until staging
- [ ] SMTP/email provider (optional, for email notifications)
- [ ] **Eskiz SMS template**: Eskiz only delivers texts matching an approved template. Ask Eskiz to approve: `OnlineDars tasdiqlash kodi: XXXXXX. Kodni hech kimga bermang.` (text is in `apps/api/src/modules/auth/otp.service.ts`)
- [ ] Optional: enable Windows **Developer Mode** (Settings → System → For developers) if you want `next build` to produce the standalone output locally; not needed for normal dev.

## Decisions

- [ ] Confirm the stack in `.claude/skills/onlinedars-stack/SKILL.md` with the client
- [ ] Hosting provider for staging + production (check Uzbek personal-data residency law with legal counsel)
- [ ] Domain name (e.g. onlinedars.uz) and DNS access
- [ ] Refund policy: on refund, revoke course access or keep it?

## Admin actions on your PCs / GitHub

- [ ] Install **Docker Desktop** on each PC (`winget install --id Docker.DockerDesktop -e`, needs admin + restart). Until then, DB-backed tests run only in GitHub Actions CI.
- [ ] GitHub → repo Settings → Branches: protect `main` (require PR + green CI). Agents don't change repo settings.
- [ ] Review the PRs agents opened overnight (see `docs/HANDOFF.md`)

## CI/CD setup (added by devops, 2026-11-22) — details in `docs/DEPLOYMENT.md` → "Turning on deploys"

- [ ] Branch protection on `main`: require a PR, require status checks `Lint + typecheck`, `Unit tests`, `API e2e + migrations`, `Build`, `Playwright smoke`, `Docker image (web)`, `Docker image (api)`, `Docker image (worker)`; block force pushes. (Optional: require code-owner review — CODEOWNERS is `@fox3mr3ygu3`.)
- [ ] Repo → Settings → Environments: create **`staging`** and **`production`**. On `production`: add yourself as required reviewer, limit deployments to tags `v*`.
- [ ] When a staging server exists: run `infra/scripts/server-setup.sh` on it, then add environment secrets `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `ENV_FILE` (template `infra/docker/prod.env.example`), and repo **variables** `STAGING_HOST`, `STAGING_URL`. Same later for production (`PRODUCTION_HOST`, `PRODUCTION_URL`). Until then deploy jobs are skipped, not failed.
- [ ] Optional: Telegram bot for deploy notifications → secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` in both environments.
- [ ] GHCR packages (`onlinedars-web`, `onlinedars-api`, `onlinedars-worker`) appear after the first merge to `main`. Keep them **private**; in each package's settings confirm the `onlinedars` repo has access (Actions). Nothing to do for the servers: deploys log in with the run's own token.
- [ ] Decide the MinIO plan for production (community images are no longer published; see `docs/DECISIONS.md`).

## Dependency advisories (pnpm audit, prod deps, 2026-11-23) — owner: architect (root `package.json` / versions)

- [ ] `postcss` 8.4.31 (high: arbitrary file read; path traversal in previous source map; fixed in >=8.5.18) — pinned by `next@15.5.x`. Fix: `pnpm.overrides` `"postcss": "^8.5.18"` in root `package.json`, or a Next release that bumps it. Build-time only (CSS processing of our own sources), low real risk.
- [ ] `deepmerge-ts` 7.1.5 (high: stack exhaustion; fixed in >=8.0.0) and `effect` 3.21.0 (high: ReDoS in Schema.TemplateLiteral; fixed in >=3.22.1) — pulled by `@prisma/config@6.19.3` (Prisma CLI config loading, not request handling). Fix: newer Prisma 6.x if it bumps them, or `pnpm.overrides` `"effect": "^3.22.1"` (deepmerge-ts 8 is a major — test before overriding).
