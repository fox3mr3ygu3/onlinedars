# Waiting on you (the user)

Agents add items here when something needs a human decision, a credential, or an admin action.
They keep working on everything else and mock or stub what's blocked. Tick an item when it's done.

## Merges waiting for you

- [ ] **Merge PR #1** (Phase 0 foundation + CI/CD) into `main`: https://github.com/fox3mr3ygu3/onlinedars/pull/1. CI is fully green (run 45069204297). Use "Create a merge commit" (not squash) so the Phase 1 branches merge cleanly. The overnight agent was not permitted to merge into `main`.

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

- [x] Fixed with `pnpm.overrides` in the root `package.json` (2026-11-23): `postcss`, `effect`, `deepmerge-ts` (8, Prisma CLI verified), `basic-ftp`. Remaining 3 highs (`extract-zip`, `zod` 3 via chromium-bidi) sit in puppeteer's browser-download code, which we never run; see `docs/DECISIONS.md`. Nothing to do unless a fix appears.

## Payments (added by backend-payments, 2026-11-23)

- [ ] **Refund policy**: the code defaults to `revoke` (access removed after a refund). To keep access instead, set the platform setting `REFUND_POLICY` to `"keep"`. Please confirm which one the client wants.
- [ ] Register callback URLs once staging exists: Payme endpoint `https://<api-domain>/api/v1/payments/payme` with account field `order_id`; Click Prepare `…/api/v1/payments/click/prepare`, Complete `…/api/v1/payments/click/complete` (details: `docs/api/payments.md`).
- [ ] Run the Payme sandbox test suite (test.paycom.uz) and a Click test payment against staging with the test credentials; then switch to live keys and `PAYME_TEST_MODE=false` for production.
- [ ] Fiscal receipts (Payme): get the IKPU code and package code for "online course" from tasnif.soliq.uz and set `PAYME_IKPU_CODE` / `PAYME_PACKAGE_CODE` (optional until fiscalisation is required).
- [ ] Payme "change key" in the merchant cabinet does not reach us automatically: update `PAYME_KEY` in the environment secrets and redeploy when the key changes.

## Certificates (added by backend-learning, 2026-11-23)

- [ ] For local certificate PDFs: set `PUPPETEER_EXECUTABLE_PATH` in `.env` to your Chrome (e.g. `C:\Program Files\Google\Chrome\Application\chrome.exe`). Without it, certificates are still issued and verifiable; only the PDF download answers "being prepared". The worker Docker image already has Chromium.
- [ ] Confirm with the client: exam retakes are blocked after a pass, and a timed-out exam is graded from the answers autosaved before the deadline.

## File storage (added by backend-content, 2026-11-23)

- [ ] Decide whether paid lesson files may be public-by-unguessable-URL (current v1 design) or must be private with short-lived signed links (more work, safer). If public is fine: set a MinIO/S3 bucket policy allowing anonymous `GetObject` on `uploads/*` only.
- [ ] Without MinIO on a PC, put `STORAGE_DRIVER=local` in your `.env` so uploads go to `apps/api/.uploads/`.
