#!/bin/sh
# Runs inside the `backup` service (postgres:17-alpine). Not meant to be run on the host.
#   chatboat-backup loop        wait for BACKUP_TIME every day, then back up (the service default)
#   chatboat-backup now         take one backup now
#   chatboat-backup list        list local and remote backups
#   chatboat-backup fetch NAME  download NAME from S3 into /backups (for restore.sh)
#
# Settings (from .env):
#   BACKUP_TIME=02:30              daily, in the container's TZ (UTC unless TZ is set)
#   BACKUP_KEEP_DAYS=14            local retention
#   BACKUP_S3_BUCKET=              set to also upload to S3-compatible storage
#   BACKUP_S3_ENDPOINT=            e.g. https://fsn1.your-objectstorage.com (empty for AWS)
#   BACKUP_S3_REGION=              e.g. eu-central-1 / fsn1
#   BACKUP_S3_ACCESS_KEY_ID= / BACKUP_S3_SECRET_ACCESS_KEY=
#   BACKUP_S3_PREFIX=chatboat      folder inside the bucket
#   BACKUP_S3_KEEP_DAYS=30         remote retention (0 = keep forever, e.g. with bucket lifecycle rules)
set -eu

DIR=/backups
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
S3_KEEP_DAYS=${BACKUP_S3_KEEP_DAYS:-30}
PREFIX=${BACKUP_S3_PREFIX:-chatboat}

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') backup: $*"; }

s3_enabled() { [ -n "${BACKUP_S3_BUCKET:-}" ]; }

# rclone is configured entirely from env, no config file. Installed on first use.
s3_setup() {
  command -v rclone >/dev/null 2>&1 || apk add --no-cache -q rclone >/dev/null
  export RCLONE_CONFIG=/dev/null
  export RCLONE_CONFIG_REMOTE_TYPE=s3
  export RCLONE_CONFIG_REMOTE_PROVIDER=Other
  export RCLONE_CONFIG_REMOTE_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}"
  export RCLONE_CONFIG_REMOTE_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-}"
  export RCLONE_CONFIG_REMOTE_REGION="${BACKUP_S3_REGION:-}"
  export RCLONE_CONFIG_REMOTE_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
  export RCLONE_S3_NO_CHECK_BUCKET=true
  REMOTE="remote:${BACKUP_S3_BUCKET}/${PREFIX}"
}

backup_now() {
  mkdir -p "$DIR"
  name="chatboat-$(date -u '+%Y%m%d-%H%M%S').dump"
  tmp="$DIR/.$name.partial"
  log "dumping database to $name"
  # Custom format: compressed, and restorable table by table with pg_restore.
  pg_dump --format=custom --no-owner --no-privileges --file="$tmp"
  mv "$tmp" "$DIR/$name"
  size=$(du -h "$DIR/$name" | cut -f1)
  log "wrote $name ($size)"

  find "$DIR" -maxdepth 1 -name 'chatboat-*.dump' -mtime +"$((KEEP_DAYS - 1))" -print -delete \
    | sed 's/^/  pruned /'

  if s3_enabled; then
    s3_setup
    log "uploading $name to $REMOTE"
    rclone copyto --s3-no-check-bucket "$DIR/$name" "$REMOTE/$name"
    if [ "$S3_KEEP_DAYS" -gt 0 ]; then
      rclone delete --min-age "${S3_KEEP_DAYS}d" --include 'chatboat-*.dump' "$REMOTE" || true
    fi
  fi

  # Read by the admin status line and by monitoring.
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$name" > "$DIR/last-success"
  log "done"
}

seconds_until() {
  now=$(date +%s)
  target=$(date -d "$(date '+%Y-%m-%d') $1:00" +%s 2>/dev/null) || { log "bad BACKUP_TIME '$1', use HH:MM"; exit 1; }
  [ "$target" -le "$now" ] && target=$((target + 86400))
  echo $((target - now))
}

case "${1:-loop}" in
  now) backup_now ;;
  list)
    ls -lh "$DIR"/chatboat-*.dump 2>/dev/null || echo "no local backups"
    if s3_enabled; then s3_setup; echo "remote ($REMOTE):"; rclone lsl "$REMOTE"; fi
    ;;
  fetch)
    [ -n "${2:-}" ] || { echo "usage: chatboat-backup fetch chatboat-YYYYmmdd-HHMMSS.dump"; exit 1; }
    s3_enabled || { echo "BACKUP_S3_BUCKET is not set"; exit 1; }
    s3_setup
    rclone copyto "$REMOTE/$2" "$DIR/$2"
    log "downloaded $2 to ./backups/"
    ;;
  loop)
    at=${BACKUP_TIME:-02:30}
    log "nightly backups at $at ($(date +%Z)), keeping $KEEP_DAYS days$(s3_enabled && echo ", uploading to s3 bucket $BACKUP_S3_BUCKET" || true)"
    while true; do
      wait=$(seconds_until "$at")
      log "next backup in $((wait / 3600))h$(((wait % 3600) / 60))m"
      sleep "$wait"
      # A failed backup is logged and retried tomorrow; the container keeps running.
      backup_now || log "FAILED (see above)"
      sleep 60
    done
    ;;
  *) echo "usage: chatboat-backup loop|now|list|fetch NAME"; exit 1 ;;
esac
