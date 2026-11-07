#!/usr/bin/env bash
# Upgrade Chatboat:  ./upgrade.sh 1.3.0   (or ./upgrade.sh latest)
# Takes a backup, pulls the new images, migrates the database and restarts.
# Roll back with:  ./upgrade.sh <previous version>  and, if a migration changed data,
# ./restore.sh backups/<the pre-upgrade backup>.
set -euo pipefail
cd "$(dirname "$0")"

die() { echo "error: $*" >&2; exit 1; }
[ -f .env ] || die "no .env here; run ./install.sh first"
version=${1:-}
[ -n "$version" ] || die "usage: ./upgrade.sh <version>  (e.g. 1.3.0; see CHANGELOG.md)"
version=${version#v}

current=$(grep '^CHATBOAT_VERSION=' .env | cut -d"'" -f2)
echo "Upgrading Chatboat $current -> $version"

echo "== Backup before upgrading"
docker compose up -d postgres backup
docker compose exec -T backup chatboat-backup now

echo "== Pulling images"
sed -i.bak "s/^CHATBOAT_VERSION=.*/CHATBOAT_VERSION='$version'/" .env && rm -f .env.bak
if ! docker compose pull --quiet api web; then
  sed -i.bak "s/^CHATBOAT_VERSION=.*/CHATBOAT_VERSION='$current'/" .env && rm -f .env.bak
  die "could not pull version $version; still on $current"
fi

echo "== Migrating and restarting"
# `up` reruns the one-shot migrate service; the API only starts once it has succeeded.
if ! docker compose up -d --remove-orphans; then
  docker compose logs --tail 80 migrate api
  die "upgrade failed. To roll back: ./upgrade.sh $current (and ./restore.sh with the backup above if needed)"
fi

for _ in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || true)
  [ "$status" = healthy ] && break
  sleep 2
done
[ "${status:-}" = healthy ] || { docker compose logs --tail 80 api; die "the API is not healthy after upgrading"; }

docker image prune -f >/dev/null
echo "Chatboat is now on $version."
