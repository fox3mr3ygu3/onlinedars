# OnlineDars

Online learning platform: courses → modules → lessons → 4 practices × 6 questions, a final exam
and a verifiable PDF certificate. Business rules: [`CLAUDE.md`](CLAUDE.md). Spec (Uzbek):
[`docs/SPEC_uz.txt`](docs/SPEC_uz.txt). Stack: [`.claude/skills/onlinedars-stack/SKILL.md`](.claude/skills/onlinedars-stack/SKILL.md).

| Part                                            | Path              | Tech                                          | Local URL                      |
| ----------------------------------------------- | ----------------- | --------------------------------------------- | ------------------------------ |
| Web (public site, student cabinet, admin panel) | `apps/web`        | Next.js 15, Tailwind v4, shadcn/ui, next-intl | http://localhost:3000          |
| API                                             | `apps/api`        | NestJS 11, Prisma, PostgreSQL 16              | http://localhost:4000/api/v1   |
| API docs (Swagger)                              |                   |                                               | http://localhost:4000/api/docs |
| Shared enums + zod schemas                      | `packages/shared` | zod 4                                         |                                |

## Requirements

- Node.js 22+ (`.nvmrc`), pnpm 9.15 (`corepack enable`)
- Docker Desktop for Postgres / Redis / MinIO (or your own Postgres 16 + Redis 7)

## First-time setup

```bash
git clone https://github.com/fox3mr3ygu3/onlinedars.git C:\dev\onlinedars
cd C:\dev\onlinedars
cp .env.example .env          # dev defaults work as-is
pnpm install
pnpm docker:up                # postgres:5432, redis:6379, minio:9000 (console :9001)
pnpm db:migrate               # apply migrations (prisma migrate dev)
pnpm db:seed                  # demo users + demo course
pnpm dev                      # web :3000 + api :4000
```

Seeded accounts (password = `SEED_PASSWORD` from `.env`, default `Parol12345!` — dev only):

| Role            | Login                                      |
| --------------- | ------------------------------------------ |
| ADMIN           | `admin@onlinedars.uz`                      |
| CONTENT_MANAGER | `content@onlinedars.uz`                    |
| STUDENT         | `student@onlinedars.uz` or `+998901234567` |

Without Eskiz credentials, SMS OTP codes are printed in the API log (`ConsoleSms`).

## Scripts (root)

| Script                           | What it does                                                               |
| -------------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`                       | Run web + api (and shared in watch mode)                                   |
| `pnpm build`                     | Build everything                                                           |
| `pnpm lint` / `pnpm typecheck`   | ESLint / TypeScript                                                        |
| `pnpm test`                      | Unit tests (Vitest, no database needed)                                    |
| `pnpm test:e2e`                  | API e2e (Supertest); needs a migrated DB at `DATABASE_URL`, skips if unset |
| `pnpm db:generate`               | Generate the Prisma client                                                 |
| `pnpm db:migrate`                | Create/apply migrations in dev (`prisma migrate dev`)                      |
| `pnpm db:migrate:deploy`         | Apply committed migrations (CI / servers)                                  |
| `pnpm db:seed`                   | Idempotent seed                                                            |
| `pnpm docker:up` / `docker:down` | Local Postgres, Redis, MinIO                                               |

## Auth in short

- `POST /api/v1/auth/register` (email, or phone + SMS code from `POST /auth/otp/request`), `POST /auth/login`
  (email or phone + password) → `{ accessToken, user }` plus an httpOnly `od_refresh` cookie (path `/api/v1/auth`).
- Access token: 15 min JWT, send as `Authorization: Bearer …`. `POST /auth/refresh` rotates the cookie;
  replaying an old refresh token revokes the session. `POST /auth/logout`, `POST /auth/password/forgot|reset`, `GET /auth/me`.
- The browser calls the API same-origin through the Next.js rewrite `/api/v1/* → API_URL`.
- Every route requires a valid token unless marked `@Public()`; use `@Roles(...)` for role checks and the
  ownership helpers in `apps/api/src/common/ownership` for student data.

## Repo layout and workflow

- Folder layout: [`docs/STRUCTURE.md`](docs/STRUCTURE.md). Who owns what: [`docs/TASKS.md`](docs/TASKS.md).
- Git routine across PCs: [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md). Session log: [`docs/HANDOFF.md`](docs/HANDOFF.md).
- Deployment, backups (`infra/backup/pg_dump.sh`), monitoring: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- Architecture decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md).
