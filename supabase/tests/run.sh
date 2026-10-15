#!/usr/bin/env bash
# Repeatable SQL test run against a throwaway local Postgres 16 (no Docker needed).
#   supabase/tests/run.sh            -> init cluster, apply mock + migrations, run tests/*.test.sql
# Requires postgres 16 binaries (initdb, pg_ctl) and psql. Exits non-zero on any failure.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
RUNAS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi

cleanup() { "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)
fresh_db() {
  "${PSQL[@]}" -d postgres -c "set client_min_messages = warning" -c "drop database if exists t" -c "create database t"
  "${PSQL[@]}" -d t -f "$HERE/supabase_mock.sql"
  for m in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -d t -f "$m"; done
}

fail=0
for t in "$HERE"/*.test.sql; do
  fresh_db
  # query output is discarded; assertion notices (ok - ...) and errors go to stderr
  if "${PSQL[@]}" -d t -o /dev/null -v VERBOSITY=terse -f "$t" 2>&1 | sed -e "s|^psql:[^ ]*: ||" -e "s|^|  |"; [ "${PIPESTATUS[0]}" = "0" ]; then
    echo "PASS $(basename "$t") ($(grep -c 'tests\.\(ok\|eq\|throws\)' "$t") assertions)"
  else
    echo "FAIL $(basename "$t")"; fail=1
  fi
done
exit $fail
