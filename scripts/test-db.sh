#!/usr/bin/env bash
# Levanta un PostgreSQL efímero, aplica el shim de Supabase + migraciones
# y ejecuta las pruebas de seguridad y operaciones críticas.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
PORT="${TEST_DB_PORT:-54329}"
DATA="$(mktemp -d)"
export PGHOST="$DATA" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

cleanup() { "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$DATA" 2>/dev/null || true
  RUN=(runuser -u postgres --)
else
  RUN=()
fi

"${RUN[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 >/dev/null
"${RUN[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null

psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/supabase-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migración $(basename "$f")"
  psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

export TEST_DATABASE_URL="postgresql://postgres@localhost:$PORT/postgres?host=$DATA"
cd "$ROOT"
node --test --test-concurrency=1 tests/db/*.test.mjs
