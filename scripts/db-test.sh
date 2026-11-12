#!/usr/bin/env bash
# Run the database migrations and SQL tests on a throwaway local Postgres.
#
#   scripts/db-test.sh          fresh database: stand-ins, all migrations, helpers, then supabase/tests/*.test.sql
#   PGURL=postgres://… scripts/db-test.sh   use an existing empty database instead (CI)
#
# The real project is never touched.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${PGURL:-}" ]; then
  BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
  DATA=/var/lib/postgresql/spazia-test
  PORT=${PGPORT:-54329}
  as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
  as_pg "$BIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$DATA"
  as_pg "$BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
  as_pg "$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -l "$DATA/log.txt" start >/dev/null
  PGURL="postgresql://postgres@/postgres?host=/tmp&port=$PORT"
fi
psql_q() { psql "$PGURL" -v ON_ERROR_STOP=1 -q -X "$@"; }

psql_q -f supabase/tests/00_supabase_stubs.sql >/dev/null
for f in supabase/migrations/*.sql; do
  # pg_net and pg_cron are replaced by the stand-ins.
  if ! sed -E '/create extension if not exists (pg_net|pg_cron)/d' "$f" | psql_q >/dev/null 2>/tmp/db-test-err.txt; then
    echo "FAIL migration $f"; cat /tmp/db-test-err.txt; exit 1
  fi
done
echo "ok   $(ls supabase/migrations/*.sql | wc -l) migrations"
psql_q -f supabase/tests/01_helpers.sql >/dev/null

status=0
for t in supabase/tests/*.test.sql; do
  [ -e "$t" ] || continue
  if out=$(psql_q -f "$t" 2>&1); then
    echo "ok   $t"
  else
    echo "FAIL $t"; echo "$out" | tail -15; status=1
  fi
done
exit $status
