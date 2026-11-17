#!/usr/bin/env bash
# Copy all data from the old Render Postgres to the new one.
# Usage: ./scripts/move-render-db.sh "OLD_EXTERNAL_DB_URL" "NEW_EXTERNAL_DB_URL"
# Use the EXTERNAL Database URLs (Render -> database -> Connections).
# Run this BEFORE the new backend's first deploy (or on an empty database).
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 \"OLD_EXTERNAL_DB_URL\" \"NEW_EXTERNAL_DB_URL\"" >&2
  exit 1
fi

OLD_URL="$1"
NEW_URL="$2"
BACKUP="$HOME/Desktop/render-backup-$(date +%Y%m%d-%H%M%S).sql"

command -v pg_dump >/dev/null || { echo "pg_dump not found. Run: brew install libpq && brew link --force libpq" >&2; exit 1; }

echo "1/2 Backing up old database to $BACKUP ..."
pg_dump "$OLD_URL" --no-owner --no-acl --clean --if-exists -f "$BACKUP"

echo "2/2 Restoring into new database ..."
psql "$NEW_URL" -v ON_ERROR_STOP=1 -q -f "$BACKUP"

echo "Done. Backup kept at $BACKUP"
