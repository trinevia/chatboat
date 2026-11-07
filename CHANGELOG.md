# Changelog

Each release lists what changed and **upgrade notes**: anything to do before or after running `./upgrade.sh <version>` (see `deploy/README.md`). Versions follow semver. A minor or patch release never needs more than `./upgrade.sh`. A major release may need manual steps and says so here.

## Unreleased

### Added

- Private-install packaging (`deploy/`):
  - Docker Compose stack with Postgres, migrations, API, web app and Caddy (automatic HTTPS)
  - `install.sh`, `upgrade.sh` and `restore.sh`
  - nightly `pg_dump` backups, kept for 14 days, with optional upload to S3-compatible storage
  - a runbook for hosting a customer on Hetzner Cloud
- Release workflow: pushing a `v*` tag publishes `ghcr.io/trinevia/chatboat-api` and `chatboat-web` (amd64 and arm64), tagged with the version, `major.minor` and `latest`. It also attaches the `deploy/` bundle to the GitHub release.

### Changed

- The API image is compiled to JavaScript with tsup and runs on Alpine: 1.41 GB → about 300 MB. The image commands are unchanged: `serve` (the default), `migrate`, `seed`.
- The API image includes a font (Liberation Sans), so chart labels in digest emails show up. Before this, they rendered blank in Docker.

### Upgrade notes

- First release with the install bundle: nothing to upgrade from.
