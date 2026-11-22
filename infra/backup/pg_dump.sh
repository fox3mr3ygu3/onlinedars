#!/usr/bin/env bash
# Nightly PostgreSQL backup for OnlineDars.
#
# - Dumps the database in custom format (pg_dump -Fc: compressed, restorable with pg_restore).
# - Keeps the last $BACKUP_KEEP_DAYS days locally.
# - Optionally copies the dump off-server with rclone ($BACKUP_REMOTE, e.g. "b2:onlinedars-backups").
#
# Usage:
#   DATABASE_URL=postgresql://... ./infra/backup/pg_dump.sh
#   # or, against the compose postgres container:
#   PG_CONTAINER=onlinedars-postgres-1 POSTGRES_USER=onlinedars POSTGRES_DB=onlinedars ./infra/backup/pg_dump.sh
#
# Cron (03:15 every night):
#   15 3 * * * cd /opt/onlinedars && ./infra/backup/pg_dump.sh >> /var/log/onlinedars-backup.log 2>&1
#
# Restore:
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" <file>.dump
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/onlinedars}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/onlinedars-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"
umask 077

log() { echo "[$(date -u +%FT%TZ)] $*"; }

log "Starting backup -> ${FILE}"
if [[ -n "${PG_CONTAINER:-}" ]]; then
  docker exec "$PG_CONTAINER" pg_dump -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" -Fc --no-owner >"${FILE}.partial"
else
  pg_dump "${DATABASE_URL:?DATABASE_URL or PG_CONTAINER must be set}" -Fc --no-owner >"${FILE}.partial"
fi
mv "${FILE}.partial" "$FILE"

# Sanity check: the archive must be readable.
if [[ -n "${PG_CONTAINER:-}" ]]; then
  docker exec -i "$PG_CONTAINER" pg_restore --list >/dev/null <"$FILE"
else
  pg_restore --list "$FILE" >/dev/null
fi
log "Backup OK ($(du -h "$FILE" | cut -f1))"

if [[ -n "$BACKUP_REMOTE" ]]; then
  log "Copying off-server to ${BACKUP_REMOTE}"
  rclone copy "$FILE" "$BACKUP_REMOTE" --immutable
fi

log "Removing local backups older than ${BACKUP_KEEP_DAYS} days"
find "$BACKUP_DIR" -name 'onlinedars-*.dump' -type f -mtime +"$BACKUP_KEEP_DAYS" -delete

log "Done"
