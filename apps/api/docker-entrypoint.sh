#!/bin/sh
set -e
case "$1" in
  serve) exec node --enable-source-maps dist/server.js ;;
  migrate) exec node --enable-source-maps dist/migrate.js ;;
  seed) exec node --enable-source-maps dist/seed.js ;;
  *) exec "$@" ;;
esac
