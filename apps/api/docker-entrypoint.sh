#!/bin/sh
set -e
case "$1" in
  serve) exec node --import tsx src/server.ts ;;
  migrate) cd /app/packages/db && exec node --import tsx src/migrate.ts ;;
  seed) cd /app/packages/db && exec node --import tsx src/seed.ts ;;
  *) exec "$@" ;;
esac
