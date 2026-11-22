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
