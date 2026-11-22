#!/usr/bin/env bash
# Deploy one image tag of the OnlineDars stack on this server.
# Runs from /opt/onlinedars (copied there by .github/actions/ssh-deploy), or by hand:
#   cd /opt/onlinedars && ./scripts/deploy.sh <image-tag>
#
# Steps: pull -> optional pre-deploy DB backup -> prisma migrate deploy -> up -d -> wait for
# health. If the new version is not healthy in time, the previous tag is started again
# (without migrating: migrations are backward-compatible, so old code runs on the new schema).
#
# Env:
#   IMAGE_PREFIX            ghcr.io/<owner>/onlinedars (default below)
#   BACKUP_BEFORE_DEPLOY    true|false (default false; production passes true)
#   SKIP_MIGRATE            true|false (default false; rollback.sh passes true)
#   ALLOW_LOCAL_IMAGES      true|false: carry on if pull fails but images exist locally
#   HEALTH_TIMEOUT          seconds to wait for healthy containers (default 90)
set -Eeuo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "usage: $0 <image-tag>" >&2
  exit 2
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

export IMAGE_TAG="$TAG"
export IMAGE_PREFIX="${IMAGE_PREFIX:-ghcr.io/fox3mr3ygu3/onlinedars}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-false}"
SKIP_MIGRATE="${SKIP_MIGRATE:-false}"
ALLOW_LOCAL_IMAGES="${ALLOW_LOCAL_IMAGES:-false}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
STATE_FILE="$DIR/.deployed_tag"
HISTORY_FILE="$DIR/.deploy_history"

compose() {
  docker compose -f "$DIR/docker-compose.prod.yml" --env-file "$DIR/.env" "$@"
}

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

[[ -f "$DIR/.env" ]] || { echo "missing $DIR/.env" >&2; exit 1; }

PREV_TAG="$(cat "$STATE_FILE" 2>/dev/null || true)"
log "deploying $IMAGE_PREFIX-*:$TAG (previous: ${PREV_TAG:-none})"

# 1. Pull
if ! compose --profile tools pull web api worker migrate; then
  if [[ "$ALLOW_LOCAL_IMAGES" == "true" ]]; then
    log "pull failed, using local images"
  else
    log "pull failed"
    exit 1
  fi
fi

# 2. Backup (before touching the schema)
if [[ "$BACKUP_BEFORE_DEPLOY" == "true" ]]; then
  log "pre-deploy database backup"
  compose up -d postgres
  "$DIR/scripts/backup-db.sh" "predeploy-${TAG}"
fi

# 3. Migrate
if [[ "$SKIP_MIGRATE" != "true" ]]; then
  log "prisma migrate deploy"
  compose --profile tools run --rm migrate
fi

# 4. Start
log "starting containers"
compose up -d --remove-orphans

# 5. Health
container_health() {
  local id
  id="$(compose ps -q "$1")"
  [[ -n "$id" ]] || { echo "missing"; return; }
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    local api web worker
    api="$(container_health api)"
    web="$(container_health web)"
    worker="$(container_health worker)"
    if [[ "$api" == "healthy" && "$web" == "healthy" && "$worker" == "running" ]]; then
      return 0
    fi
    log "waiting: api=$api web=$web worker=$worker"
    sleep 5
  done
  return 1
}

if wait_healthy; then
  echo "$TAG" > "$STATE_FILE"
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TAG" >> "$HISTORY_FILE"
  log "healthy: $TAG is live"
  # Remove dangling layers only; tagged older images stay for rollback.
  docker image prune -f >/dev/null || true
  exit 0
fi

log "NOT healthy after ${HEALTH_TIMEOUT}s"
compose logs --tail=80 api web worker || true

if [[ -n "$PREV_TAG" && "$PREV_TAG" != "$TAG" ]]; then
  log "rolling back to $PREV_TAG"
  export IMAGE_TAG="$PREV_TAG"
  compose up -d --remove-orphans
  if wait_healthy; then
    log "rolled back to $PREV_TAG"
  else
    log "rollback to $PREV_TAG is not healthy either - manual action needed"
  fi
fi
exit 1
