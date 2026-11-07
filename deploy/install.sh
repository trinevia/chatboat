#!/usr/bin/env bash
# Chatboat installer: asks a few questions, writes .env with fresh secrets, starts the stack.
# Then open https://<domain>/setup to create the company and its first admin.
#
#   ./install.sh                 interactive
#   ./install.sh --yes           non-interactive: answers come from environment variables
#                                (DOMAIN, ACME_EMAIL, SMTP_URL, AI_PROVIDER, ANTHROPIC_API_KEY, ...)
#   ./install.sh --seed          also load the sample business data (demo installs)
#
# Re-running it with an existing .env keeps that file (the secrets in it unlock the existing
# database) and just pulls and starts the stack again.
set -euo pipefail
cd "$(dirname "$0")"

YES=0 SEED=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=1 ;;
    --seed) SEED=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg"; exit 1 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { echo "error: $*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker is not installed. See https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (the 'docker compose' command)."
command -v openssl >/dev/null || die "openssl is required to generate secrets."

# ask VAR "Question" [default] [secret]: keeps a value already in the environment.
ask() {
  local var=$1 prompt=$2 default=${3:-} secret=${4:-} value=${!1:-}
  if [ -z "$value" ] && [ "$YES" = 0 ]; then
    local shown=$prompt
    [ -n "$default" ] && shown="$prompt [$default]"
    if [ -n "$secret" ]; then read -r -s -p "$shown: " value; echo; else read -r -p "$shown: " value; fi
  fi
  value=${value:-$default}
  case "$value" in *"'"*|*$'\n'*) die "$var can't contain a single quote or newline" ;; esac
  printf -v "$var" '%s' "$value"
}

require() { [ -n "${!1:-}" ] || die "$1 is required${2:+ ($2)}"; }

secret_b64() { openssl rand -base64 "$1" | tr -d '\n'; }
secret_hex() { openssl rand -hex "$1"; }

if [ -f .env ]; then
  bold "Using the existing .env (delete it only if you are starting over with an empty database)."
else
  bold "Chatboat setup"
  echo "Point your domain's DNS (A/AAAA record) at this server before continuing,"
  echo "so the HTTPS certificate can be issued."
  echo

  default_version=latest
  [ -f VERSION ] && default_version=$(tr -d '[:space:]' < VERSION)
  ask CHATBOAT_VERSION "Chatboat version" "$default_version"
  ask DOMAIN "Domain (e.g. chat.example.com)"
  require DOMAIN
  ask ACME_EMAIL "Admin email (for certificate expiry notices)"
  require ACME_EMAIL

  HTTPS_PORT=${HTTPS_PORT:-443} HTTP_PORT=${HTTP_PORT:-80}
  PUBLIC_URL="https://$DOMAIN"
  [ "$HTTPS_PORT" != 443 ] && PUBLIC_URL="https://$DOMAIN:$HTTPS_PORT"

  echo
  bold "Email (digests and sign-in mails)"
  ask SMTP_URL "SMTP URL (smtps://user:password@smtp.example.com:465)"
  require SMTP_URL "digests can't be sent without it"
  ask MAIL_FROM "Sender" "Chatboat <chatboat@$DOMAIN>"

  echo
  bold "AI provider"
  echo "One of: anthropic, openai, google, nvidia, azure, bedrock, openai-compatible"
  ask AI_PROVIDER "Provider" "anthropic"
  provider_env=()
  case "$AI_PROVIDER" in
    anthropic) ask ANTHROPIC_API_KEY "Anthropic API key" "" secret; require ANTHROPIC_API_KEY; provider_env=(ANTHROPIC_API_KEY) ;;
    openai) ask OPENAI_API_KEY "OpenAI API key" "" secret; require OPENAI_API_KEY; provider_env=(OPENAI_API_KEY) ;;
    google) ask GOOGLE_GENERATIVE_AI_API_KEY "Google AI API key" "" secret; require GOOGLE_GENERATIVE_AI_API_KEY; provider_env=(GOOGLE_GENERATIVE_AI_API_KEY) ;;
    nvidia) ask NVIDIA_API_KEY "NVIDIA API key" "" secret; require NVIDIA_API_KEY; provider_env=(NVIDIA_API_KEY) ;;
    azure)
      ask AZURE_RESOURCE_NAME "Azure OpenAI resource name"; require AZURE_RESOURCE_NAME
      ask AZURE_API_KEY "Azure OpenAI API key" "" secret; require AZURE_API_KEY
      provider_env=(AZURE_RESOURCE_NAME AZURE_API_KEY) ;;
    bedrock)
      ask AWS_REGION "AWS region" "us-east-1"
      ask AWS_ACCESS_KEY_ID "AWS access key id"; require AWS_ACCESS_KEY_ID
      ask AWS_SECRET_ACCESS_KEY "AWS secret access key" "" secret; require AWS_SECRET_ACCESS_KEY
      provider_env=(AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY) ;;
    openai-compatible)
      ask AI_BASE_URL "Base URL (e.g. http://ollama:11434/v1)"; require AI_BASE_URL
      ask AI_API_KEY "API key (empty if none)" "" secret
      provider_env=(AI_BASE_URL AI_API_KEY) ;;
    *) die "unknown AI provider '$AI_PROVIDER'" ;;
  esac
  case "$AI_PROVIDER" in
    azure|openai-compatible) ask AI_MODEL "Model (deployment / model name)"; require AI_MODEL ;;
    *) ask AI_MODEL "Model (empty for the provider default)" "" ;;
  esac

  echo
  bold "Off-site backups (S3-compatible storage, e.g. Hetzner Object Storage)"
  if [ -z "${BACKUP_S3_BUCKET:-}" ] && [ "$YES" = 0 ]; then
    read -r -p "Upload nightly backups to S3? [y/N]: " s3
    if [[ "$s3" =~ ^[Yy] ]]; then
      ask BACKUP_S3_ENDPOINT "Endpoint (empty for AWS S3)" ""
      ask BACKUP_S3_REGION "Region" "us-east-1"
      ask BACKUP_S3_BUCKET "Bucket"; require BACKUP_S3_BUCKET
      ask BACKUP_S3_ACCESS_KEY_ID "Access key id"; require BACKUP_S3_ACCESS_KEY_ID
      ask BACKUP_S3_SECRET_ACCESS_KEY "Secret access key" "" secret; require BACKUP_S3_SECRET_ACCESS_KEY
    fi
  fi

  umask 077
  {
    echo "# Written by install.sh on $(date -u '+%Y-%m-%d %H:%M UTC'). Keep a copy somewhere safe:"
    echo "# without these secrets a backup can't be decrypted or signed in to."
    echo
    echo "COMPOSE_PROJECT_NAME='${COMPOSE_PROJECT_NAME:-chatboat}'"
    echo "CHATBOAT_VERSION='$CHATBOAT_VERSION'"
    echo "DOMAIN='$DOMAIN'"
    echo "PUBLIC_URL='$PUBLIC_URL'"
    echo "ACME_EMAIL='$ACME_EMAIL'"
    echo "HTTP_PORT='$HTTP_PORT'"
    echo "HTTPS_PORT='$HTTPS_PORT'"
    echo
    echo "# Secrets (generated)"
    echo "BETTER_AUTH_SECRET='$(secret_b64 48)'"
    echo "DATA_ENCRYPTION_KEY='$(secret_b64 32)'"
    echo "POSTGRES_PASSWORD='$(secret_hex 24)'"
    echo "ANALYST_PASSWORD='$(secret_hex 24)'"
    echo
    echo "# Email"
    echo "SMTP_URL='$SMTP_URL'"
    echo "MAIL_FROM='$MAIL_FROM'"
    echo
    echo "# AI"
    echo "AI_PROVIDER='$AI_PROVIDER'"
    echo "AI_MODEL='$AI_MODEL'"
    for v in "${provider_env[@]}"; do echo "$v='${!v}'"; done
    echo "DAILY_QUESTION_LIMIT='${DAILY_QUESTION_LIMIT:-100}'"
    echo
    echo "# Backups"
    echo "BACKUP_TIME='${BACKUP_TIME:-02:30}'"
    echo "BACKUP_KEEP_DAYS='${BACKUP_KEEP_DAYS:-14}'"
    for v in BACKUP_S3_ENDPOINT BACKUP_S3_REGION BACKUP_S3_BUCKET BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY; do
      echo "$v='${!v:-}'"
    done
  } > .env
  chmod 600 .env
  bold "Wrote .env"
fi

mkdir -p backups

bold "Pulling images"
docker compose pull --ignore-pull-failures --quiet

bold "Starting Chatboat"
docker compose up -d --remove-orphans

if [ "$SEED" = 1 ]; then
  bold "Loading sample data"
  docker compose run --rm migrate seed
fi

printf 'Waiting for the API'
for _ in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || true)
  [ "$status" = healthy ] && break
  printf '.'; sleep 2
done
echo
[ "${status:-}" = healthy ] || { docker compose logs --tail 50 migrate api; die "the API did not become healthy"; }

url=$(grep '^PUBLIC_URL=' .env | cut -d"'" -f2)
bold "Chatboat is running at $url"
echo "Open it to finish setup: the first-run wizard creates the company and the admin account."
echo "Backups go to $(pwd)/backups every night (see README.md to copy them off this server)."
