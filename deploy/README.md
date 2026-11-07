# Installing Chatboat

Chatboat runs as five containers on one Linux server: Postgres, the API, the web app, Caddy (HTTPS) and a backup job. You install a released version (e.g. `1.2.0`); images come from `ghcr.io/trinevia/chatboat-api` and `ghcr.io/trinevia/chatboat-web`.

| File | What it does |
|---|---|
| `install.sh` | Asks for domain, email and AI settings, generates secrets, writes `.env`, starts everything |
| `upgrade.sh <version>` | Backs up, pulls the new version, migrates the database, restarts |
| `restore.sh [file]` | Replaces the database with a backup |
| `docker-compose.yml` | The stack. Settings come from `.env` |
| `Caddyfile` | HTTPS on your domain, `/api` to the API, everything else to the web app |
| `backup.sh` | Runs inside the `backup` container: nightly `pg_dump`, retention, S3 upload |
| `.env.example` | Every setting, with comments |

Run all commands from this folder.

## Requirements

- A Linux server with 2 vCPU, 4 GB RAM and 40 GB disk (x86-64 or ARM64)
- Docker Engine 24+ with the Compose plugin (`docker compose version`)
- A domain name whose A (and AAAA, if you use IPv6) record points at the server
- Ports 80 and 443 open (TCP, plus UDP 443 for HTTP/3). Port 80 is needed to issue the certificate.
- An SMTP account for emails (any provider: Postmark, SES, Mailgun, your own server)
- An AI provider: Anthropic, OpenAI, Google, NVIDIA, Azure OpenAI, Amazon Bedrock, or your own OpenAI-compatible server (vLLM, Ollama)

## Install

```bash
tar -xzf chatboat-deploy-v1.2.0.tar.gz && cd deploy
./install.sh
```

The script asks for:

- **Version:** defaults to the version of the bundle you downloaded
- **Domain:** e.g. `chat.example.com`
- **Admin email:** used for Let's Encrypt expiry notices
- **SMTP URL:** e.g. `smtps://user:password@smtp.example.com:465`
- **Sender:** e.g. `Chatboat <chatboat@example.com>`
- **AI provider, its keys and the model:** the model is optional for most providers
- **Off-site backups:** optional S3 bucket and keys

It generates `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `POSTGRES_PASSWORD` and `ANALYST_PASSWORD` with `openssl`, writes them to `.env` (mode 600), pulls the images and starts the stack. Migrations run automatically before the API starts.

Then open `https://<your domain>`. The first-run setup page creates the company and its first admin. Everyone else joins by invitation from the admin area.

> **Copy `.env` somewhere safe** (a password manager or secrets vault). A database backup is useless without it: the encryption key and secrets in it can't be recovered.

**Non-interactive install** (scripts, automation): set the answers as environment variables and pass `--yes`:

```bash
DOMAIN=chat.example.com ACME_EMAIL=it@example.com \
SMTP_URL='smtps://user:pass@smtp.example.com:465' \
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... \
CHATBOAT_VERSION=1.2.0 ./install.sh --yes
```

Add `--seed` to load the sample business data (for demos and trials).

Running `install.sh` again keeps the existing `.env` and just pulls and starts the stack.

### Changing settings later

Edit `.env`, then run `docker compose up -d`. Never change the generated secrets on a running install. `POSTGRES_PASSWORD` in particular is only applied when the database is first created.

## Upgrade

Read the upgrade notes for the new version in `CHANGELOG.md`, then:

```bash
./upgrade.sh 1.3.0
```

It:

1. takes a backup (`backups/chatboat-<date>.dump`)
2. sets `CHATBOAT_VERSION` in `.env` and pulls the images. If the pull fails, nothing changes.
3. runs `docker compose up -d`: the `migrate` service applies new migrations, then the API and web app restart on the new version
4. waits for the API to report healthy

**Rolling back:** `./upgrade.sh 1.2.0` goes back to the old images. If the new version's migrations changed data in a way the old version can't read, also restore the backup taken in step 1 (`./restore.sh backups/<that file>`). The changelog says when that's needed.

## Backups

The `backup` service runs `pg_dump` every night at `BACKUP_TIME` (default `02:30` UTC). It writes a compressed dump to `./backups/chatboat-YYYYmmdd-HHMMSS.dump` and deletes local dumps older than `BACKUP_KEEP_DAYS` (default 14). It records the last successful run in `backups/last-success`.

```bash
docker compose exec backup chatboat-backup now     # back up right now
docker compose exec backup chatboat-backup list    # local (and S3) backups
docker compose logs backup                         # history, including failures
```

**Off-site copies:** set the `BACKUP_S3_*` settings in `.env` and every backup is also uploaded with rclone. This works with Hetzner Object Storage, AWS S3, Cloudflare R2, MinIO and other S3-compatible storage. Remote copies older than `BACKUP_S3_KEEP_DAYS` (default 30, `0` = never) are deleted. Run `docker compose up -d backup` after changing these settings. The first S3 upload installs rclone in the container, so the server needs internet access then.

```env
BACKUP_S3_ENDPOINT='https://fsn1.your-objectstorage.com'   # empty for AWS
BACKUP_S3_REGION='fsn1'
BACKUP_S3_BUCKET='acme-chatboat-backups'
BACKUP_S3_ACCESS_KEY_ID='...'
BACKUP_S3_SECRET_ACCESS_KEY='...'
```

Use a bucket per customer and an access key that can only reach that bucket.

What's backed up: the whole `chatboat` database (users, chats, dashboards, settings, and the `biz` data). What isn't: `.env` (keep it separately, see above) and Caddy's certificates (they're issued again automatically).

## Restore

```bash
./restore.sh                                         # newest file in ./backups
./restore.sh backups/chatboat-20261107-023000.dump   # a specific file
./restore.sh --from-s3 chatboat-20261107-023000.dump # download from S3 first
```

It asks you to type `restore`, then:

1. stops the API, web app and backup job
2. drops and recreates the database
3. loads the dump with `pg_restore`
4. runs migrations, which re-create the read-only `analyst_ro` role and apply any migrations newer than the backup
5. starts everything again

Signed-in users stay signed in if the backup still holds their session.

**Moving to a new server (or recovering from a lost one):**

1. Copy `.env` from your safe place into `deploy/` on the new server.
2. Run `./install.sh`. It keeps the `.env` and starts an empty install.
3. Run `./restore.sh --from-s3 <file>`, or copy a dump into `backups/` and run `./restore.sh`.
4. Point DNS at the new server.

Test a restore on a spare server every few months. A backup you haven't restored isn't a backup.

## Operations

```bash
docker compose ps                     # status; api and web show (healthy)
docker compose logs -f api            # API logs (logs rotate at 5 × 10 MB per service)
docker compose run --rm migrate seed  # load sample data (demo installs only)
docker compose down                   # stop (data stays in the pgdata volume)
```

Disk use is mostly Postgres (`docker system df -v`) and `./backups`.

To run several installs on one machine (e.g. staging), give each folder its own `COMPOSE_PROJECT_NAME`, `HTTP_PORT` and `HTTPS_PORT` in `.env`.
