# Repository structure

```
platform/
├── CLAUDE.md                     # auto-loaded project context
├── CHANGELOG.md                  # release notes per version tag
├── .github/
│   ├── workflows/ci.yml          # lint, typecheck, tests, build on every push/PR
│   ├── workflows/deploy.yml      # staging on main, production on tag v*
│   ├── dependabot.yml
│   ├── pull_request_template.md
│   └── CODEOWNERS
├── .claude/
│   ├── skills/onlinedars-stack/SKILL.md   # stack & conventions
│   └── agents/                   # subagent definitions (one per role in docs/TASKS.md)
├── docs/
│   ├── SPEC_uz.txt               # original technical spec (Uzbek)
│   ├── STRUCTURE.md              # this file
│   ├── TASKS.md                  # work split per agent
│   ├── GIT_WORKFLOW.md           # branches, multi-PC routine, secrets
│   ├── HANDOFF.md                # session-by-session "where we stopped" log
│   ├── DEPLOYMENT.md             # environments, CI/CD, backups, monitoring, scaling
│   ├── DECISIONS.md              # architecture decisions log
│   └── api/                      # exported OpenAPI, route list
├── apps/
│   ├── web/                      # Next.js 15 — all three panels
│   │   ├── messages/uz.json      # i18n strings
│   │   ├── public/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (public)/             # /, /courses, /courses/[slug], /directions, /teachers, /faq
│   │       │   │   └── verify/[certificateId]/   # public certificate check
│   │       │   ├── (auth)/               # /login, /register, /forgot-password
│   │       │   ├── (student)/cabinet/    # dashboard, courses, courses/[id]/lessons/[lessonId],
│   │       │   │                         # practice/[practiceId], exam, results, certificates,
│   │       │   │                         # requests, profile
│   │       │   └── (admin)/admin/        # dashboard, courses, courses/[id]/modules, lessons/[id],
│   │       │                             # lessons/[id]/practices, exams, certificates, students,
│   │       │                             # access-requests, reports, settings, audit
│   │       ├── components/
│   │       │   ├── ui/                   # shadcn primitives
│   │       │   └── layout/               # headers, sidebars, footers per panel
│   │       ├── features/                 # domain components
│   │       │   ├── catalog/  course/  lesson/  practice/  exam/
│   │       │   ├── certificate/  profile/
│   │       │   └── admin/<domain>/
│   │       ├── lib/
│   │       │   ├── api/                  # typed API client
│   │       │   ├── auth/                 # session helpers
│   │       │   └── utils.ts
│   │       ├── i18n/                     # next-intl config
│   │       └── middleware.ts             # role-based route protection
│   └── api/                      # NestJS 11
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── common/                   # guards (jwt, roles, ownership), decorators, filters, pipes
│       │   ├── config/
│       │   ├── prisma/                   # PrismaService
│       │   ├── modules/
│       │   │   ├── auth/  users/  directions/  teachers/  faq/
│       │   │   ├── courses/  modules/  lessons/  practices/  questions/
│       │   │   ├── progress/  exams/  certificates/
│       │   │   ├── access-requests/      # student requests, admin approve/reject
│       │   │   ├── files/  reports/  settings/  audit/  notifications/
│       │   ├── jobs/                     # BullMQ processors (certificate-pdf, notify)
│       │   └── templates/certificate/    # HTML template for PDF
│       └── test/                         # e2e (supertest)
├── packages/
│   ├── shared/                   # zod schemas, enums, types shared by web & api
│   │   └── src/{enums,schemas,types}/
│   ├── eslint-config/
│   └── tsconfig/
├── e2e/                          # Playwright end-to-end tests
├── infra/
│   ├── docker-compose.yml        # local: postgres, redis, minio
│   ├── docker-compose.prod.yml   # staging/prod: caddy, web, api, worker, postgres, redis, minio
│   ├── caddy/Caddyfile           # HTTPS reverse proxy
│   ├── docker/                   # Dockerfiles (web, api, worker)
│   ├── scripts/                  # server setup/hardening, deploy, rollback
│   ├── backup/                   # pg_dump + MinIO sync, restore guide
│   └── loadtest/                 # k6 scripts
├── .env.example
├── package.json  pnpm-workspace.yaml  turbo.json
```

## Where things go

- New DB model → `apps/api/prisma/schema.prisma` + migration.
- Shared validation / enums (QuestionType, AccessRequestStatus, Role, CourseStatus) → `packages/shared`.
- New API endpoint → `apps/api/src/modules/<domain>/` (controller, service, dto, `*.spec.ts`).
- New page → `apps/web/src/app/<group>/...`; its components → `apps/web/src/features/<domain>/`.
- New UI text → `apps/web/messages/uz.json`.
