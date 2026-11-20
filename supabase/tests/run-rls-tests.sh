#!/usr/bin/env bash
# Ejecuta migraciones + tests de RLS contra una base de datos DESECHABLE.
#
# ⚠️  Este script BORRA el esquema public. Nunca lo apuntes a producción.
#
# Uso:
#   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/carta_test \
#     npm run test:db
#
# En Supabase local (supabase start) la URL es postgresql://postgres:postgres@127.0.0.1:54322/postgres
# y NO hace falta el stub: el script detecta que el esquema auth ya existe.
set -euo pipefail

: "${TEST_DATABASE_URL:?Define TEST_DATABASE_URL apuntando a una base de datos de pruebas}"
: "${CONFIRM_DESTRUCTIVE:?Define CONFIRM_DESTRUCTIVE=yes para confirmar que la BD es desechable}"
[ "$CONFIRM_DESTRUCTIVE" = "yes" ] || { echo "CONFIRM_DESTRUCTIVE debe valer 'yes'"; exit 1; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q)

echo "→ Reiniciando esquema public"
"${PSQL[@]}" -c "drop schema if exists public cascade; create schema public; grant usage on schema public to public;"

HAS_AUTH="$("${PSQL[@]}" -tA -c "select exists(select 1 from information_schema.schemata where schema_name = 'auth');")"
if [ "$HAS_AUTH" != "t" ]; then
  echo "→ Aplicando stub de Supabase (no hay esquema auth)"
  "${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
fi

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done

echo "→ Ejecutando tests de RLS"
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls.test.sql"
echo "✔ Tests de RLS superados"
