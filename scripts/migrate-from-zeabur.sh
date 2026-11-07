#!/usr/bin/env bash
# Dump Zeabur Postgres → restore into Neon.
# Usage:
#   ZEABUR_DATABASE_URL='postgresql://...' \
#   DATABASE_URL='postgresql://...@....neon.tech/neondb?sslmode=require' \
#   ./scripts/migrate-from-zeabur.sh
set -euo pipefail
if [[ -z "${ZEABUR_DATABASE_URL:-}" || -z "${DATABASE_URL:-}" ]]; then
  echo "Set ZEABUR_DATABASE_URL and DATABASE_URL" >&2
  exit 1
fi
DUMP="$(mktemp -t menu-app-zeabur.XXXXXX.sql)"
trap 'rm -f "$DUMP"' EXIT
echo "Dumping Zeabur..."
pg_dump --no-owner --no-acl --clean --if-exists "$ZEABUR_DATABASE_URL" > "$DUMP"
echo "Restoring into Neon..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DUMP"
echo "Done."
