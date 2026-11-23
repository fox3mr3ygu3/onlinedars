#!/usr/bin/env bash
# On-demand PostgreSQL backup (custom format, compressed) into /opt/onlinedars/backups.
#   ./scripts/backup-db.sh [label]      # label defaults to "manual"
# deploy.sh calls this as "predeploy-<tag>" before production migrations.
# The nightly backup + off-server copy is a separate job (infra/backup/, see DEPLOYMENT.md).
# Restore: infra/scripts/RESTORE.md.
set -Eeuo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${1:-manual}"
KEEP="${KEEP_PREDEPLOY:-10}"
OUT_DIR="$DIR/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/${LABEL//[^A-Za-z0-9._-]/_}-${STAMP}.dump"

# The compose file requires IMAGE_TAG; reuse the live one when run by hand.
export IMAGE_TAG="${IMAGE_TAG:-$(cat "$DIR/.deployed_tag" 2>/dev/null || echo main)}"

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

compose() {
  docker compose -f "$DIR/docker-compose.prod.yml" --env-file "$DIR/.env" "$@"
}

# Credentials are read inside the container from its own environment.
# shellcheck disable=SC2016
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6' > "$OUT.partial"
mv "$OUT.partial" "$OUT"
chmod 600 "$OUT"

# Sanity check: the archive has a readable table of contents.
compose exec -T postgres pg_restore --list < "$OUT" > /dev/null

echo "backup written: $OUT ($(du -h "$OUT" | cut -f1))"

# Keep only the newest $KEEP pre-deploy dumps on the server.
if [[ "$LABEL" == predeploy-* ]]; then
  find "$OUT_DIR" -maxdepth 1 -name 'predeploy-*.dump' -printf '%T@ %p\n' \
    | sort -rn | tail -n +"$((KEEP + 1))" | cut -d' ' -f2- | xargs -r rm -f
fi
