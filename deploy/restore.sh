#!/usr/bin/env bash
# Restore the database from a backup. REPLACES all current data.
#
#   ./restore.sh                                    newest file in ./backups
#   ./restore.sh backups/chatboat-20261107-023000.dump
#   ./restore.sh --from-s3 chatboat-20261107-023000.dump   download it first
#   add --yes to skip the confirmation
#
# The API, web and backup services are stopped during the restore, then migrations run
# (re-creating the analyst_ro role and applying any migrations newer than the backup).
set -euo pipefail
cd "$(dirname "$0")"

die() { echo "error: $*" >&2; exit 1; }
[ -f .env ] || die "no .env here; run ./install.sh first (with the .env from the old server)"

YES=0 FILE='' S3=''
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) YES=1 ;;
    --from-s3) S3=${2:?--from-s3 needs a file name}; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) FILE=$1 ;;
  esac
  shift
done

docker compose up -d postgres
if [ -n "$S3" ]; then
  docker compose run --rm --no-deps backup fetch "$S3"
  FILE=backups/$S3
fi
if [ -z "$FILE" ]; then
  FILE=$(ls -1t backups/chatboat-*.dump 2>/dev/null | head -n1 || true)
  [ -n "$FILE" ] || die "no backups in ./backups"
fi
[ -f "$FILE" ] || die "$FILE not found"

echo "Restore $FILE ($(du -h "$FILE" | cut -f1)) into $(grep '^PUBLIC_URL=' .env | cut -d"'" -f2)?"
echo "This replaces ALL current data."
if [ "$YES" = 0 ]; then
  read -r -p "Type 'restore' to continue: " answer
  [ "$answer" = restore ] || die "cancelled"
fi

echo "== Stopping the app"
docker compose stop api web backup

echo "== Recreating the database"
psql() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U chatboat "$@"; }
for _ in $(seq 1 30); do docker compose exec -T postgres pg_isready -U chatboat -q && break; sleep 1; done
psql -d postgres -q -c 'DROP DATABASE IF EXISTS chatboat WITH (FORCE)' -c 'CREATE DATABASE chatboat OWNER chatboat'

echo "== Restoring"
docker compose exec -T postgres pg_restore --no-owner --no-privileges --exit-on-error -U chatboat -d chatboat < "$FILE"

echo "== Migrating and starting"
docker compose up -d --force-recreate migrate
docker compose up -d
for _ in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || true)
  [ "$status" = healthy ] && break
  sleep 2
done
[ "${status:-}" = healthy ] || { docker compose logs --tail 80 migrate api; die "the API is not healthy after the restore"; }
echo "Restored $FILE."
