# Changelog

All notable changes to OnlineDars are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
[Semantic Versioning](https://semver.org/); each release is a git tag `vMAJOR.MINOR.PATCH`
that deploys to production after approval.

How to release: move the "Unreleased" items under a new version heading with today's date,
commit `chore(release): vX.Y.Z` via PR, then tag `main` (`git tag vX.Y.Z && git push origin vX.Y.Z`).

## [Unreleased]

### Added

- Admin-only course access (new default): students get a course only when an admin grants it; prices and checkout are hidden. Admin → Settings → "Kursga kirish tartibi" can switch back to self-service (free enrolment and Payme/Click).
- CI on every push and pull request: lint, typecheck, unit tests, API e2e against Postgres 16 + Redis 7, migration and drift check, build, Docker image build check, Playwright smoke (once `e2e/` exists), dependency audit.
- Deploy pipeline: images for web, api and worker pushed to GHCR; staging deploy on merge to `main`; production deploy on `v*` tags with manual approval; health check and automatic rollback; manual redeploy of any tag.
- Production Docker images (multi-stage, non-root) and a Docker Compose stack with Caddy (HTTPS), Postgres, Redis and MinIO on an internal network.
- Server hardening, deploy, rollback and pre-deploy backup scripts; restore guide.
- k6 load tests for catalog browsing, an exam-submit spike and payment callbacks.
- Dependabot, pull request template and CODEOWNERS.
