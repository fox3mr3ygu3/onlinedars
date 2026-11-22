# Waiting on you (the user)

Agents add items here when something needs a human decision, a credential, or an admin action.
They keep working on everything else and mock or stub what's blocked. Tick an item when it's done.

## Credentials & accounts (agents use mocks/test stubs until these exist)
- [ ] **Payme** merchant ID + test key (sandbox), then live key → GitHub Environment secrets, never in files
- [ ] **Click** service ID, merchant ID, secret key (test, then live)
- [ ] **Eskiz.uz** SMS account (email + password/token) for phone OTP
- [ ] **Sentry** project DSNs (web + api), optional until staging
- [ ] SMTP/email provider (optional, for email notifications)

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
