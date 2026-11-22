#!/usr/bin/env bash
# Roll back to an earlier image tag on this server, without running migrations.
#   ./scripts/rollback.sh            # previous successful tag from .deploy_history
#   ./scripts/rollback.sh v1.1.0     # a specific tag
# Preferred way from GitHub: Actions -> Deploy -> Run workflow (environment + image_tag).
#
# Never run "down" migrations. Schema changes are expand -> migrate -> contract, so the older
# release works on the current schema. If data must be restored, see RESTORE.md.
set -Eeuo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HISTORY_FILE="$DIR/.deploy_history"
CURRENT="$(cat "$DIR/.deployed_tag" 2>/dev/null || true)"

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  [[ -f "$HISTORY_FILE" ]] || { echo "no $HISTORY_FILE; pass a tag explicitly" >&2; exit 2; }
  # Last recorded tag that differs from the current one.
  TARGET="$(awk '{print $2}' "$HISTORY_FILE" | grep -vxF "${CURRENT:-__none__}" | tail -n 1 || true)"
  [[ -n "$TARGET" ]] || { echo "no earlier tag in $HISTORY_FILE" >&2; exit 2; }
fi

echo "rollback: ${CURRENT:-unknown} -> $TARGET"
SKIP_MIGRATE=true ALLOW_LOCAL_IMAGES=true BACKUP_BEFORE_DEPLOY=false \
  exec "$DIR/scripts/deploy.sh" "$TARGET"
