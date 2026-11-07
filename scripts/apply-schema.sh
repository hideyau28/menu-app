#!/usr/bin/env bash
# Apply schema + migrations to DATABASE_URL (Neon direct or pooled).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/schema.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/migrations/001_add_foreign_currency.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/migrations/002_add_custom_splits.sql"
echo "Schema applied."
