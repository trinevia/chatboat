# Runbook: hosting one customer on Hetzner Cloud

One customer gets one small server, one bucket for off-site backups and one DNS name. Setting up a new customer takes about 30 minutes. Do it from the Hetzner Cloud Console, the `hcloud` CLI, or Claude with the Hetzner connection.

Naming: use the customer's short name everywhere, e.g. `acme`. That gives the server `chatboat-acme`, the bucket `chatboat-acme-backups` and the domain `acme.chatboat.ai` (or the customer's own domain, e.g. `chat.acme.com`).

## 1. Server

| Setting | Value |
|---|---|
| Location | Nearest to the customer: `fsn1`/`nbg1` (Germany), `hel1` (Finland), `ash`/`hil` (US), `sin` (Singapore) |
| Image | Ubuntu 24.04 |
| Type | 2 vCPU / 4 GB shared (e.g. CAX11 Arm or CX22 x86). Move to 4 vCPU / 8 GB above about 50 active users. Both architectures are supported. |
| Networking | Public IPv4 and IPv6 |
| SSH key | Our ops key (never a password) |
| Firewall | `chatboat-web`: inbound TCP 22 (our office/VPN IPs only, if possible), TCP 80, TCP 443, UDP 443 |
| Backups | Turn on Hetzner server backups (+20 % of the server price): a second, whole-disk safety net |
| Labels | `app=chatboat`, `customer=acme` |
| Name | `chatboat-acme` |

Optional cloud-init (`--user-data-from-file`), so Docker is ready on first boot:

```yaml
#cloud-config
package_update: true
packages: [unattended-upgrades]
runcmd:
  - curl -fsSL https://get.docker.com | sh
  - mkdir -p /opt/chatboat
```

## 2. DNS

Create an `A` record (and `AAAA` for IPv6) for the domain pointing at the server's IPs, with a short TTL (300). Check it before installing, because Caddy needs it to get the certificate:

```bash
dig +short acme.chatboat.ai
```

If the customer uses their own domain, send them the two records to create and wait until `dig` shows them.

## 3. Off-site backup bucket

In Hetzner Object Storage, in the same region as the server or a different one for disaster recovery:

1. Create the bucket `chatboat-acme-backups` (private).
2. Create S3 credentials for it. Store them in our password manager under the customer.
3. Endpoint: `https://<location>.your-objectstorage.com` (e.g. `https://fsn1.your-objectstorage.com`). Region: the location (e.g. `fsn1`).

## 4. Install

```bash
ssh root@<server-ip>
docker compose version                  # if missing: curl -fsSL https://get.docker.com | sh
cd /opt/chatboat
curl -fsSLO https://github.com/trinevia/chatboat/releases/download/v1.2.0/chatboat-deploy-v1.2.0.tar.gz
tar -xzf chatboat-deploy-v1.2.0.tar.gz && cd deploy
```

If the GitHub repository and images are private, log the server in to the registry first with a read-only token (a fine-grained PAT with `read:packages`), or download the bundle on your laptop and `scp` it over:

```bash
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u trinevia --password-stdin
```

Then run the installer. Answer yes to off-site backups and use the bucket from step 3:

```bash
./install.sh
```

Then:

1. Open `https://acme.chatboat.ai`. The page has a valid certificate and shows the first-run setup.
2. Either create the customer's admin with them on a call, or create it with a temporary password and hand it over.
3. Store a copy of `/opt/chatboat/deploy/.env` in the password manager under the customer. **Required:** without it, backups can't be used.
4. Check that backups work:

   ```bash
   docker compose exec backup chatboat-backup now
   docker compose exec backup chatboat-backup list    # shows the dump locally and in the bucket
   ```

## 5. Hand-over checklist

- [ ] `https://<domain>/login` loads with a valid certificate
- [ ] Admin account created, and the customer can sign in
- [ ] A test question gets an answer (AI key works)
- [ ] An invitation email arrives (SMTP works)
- [ ] Backup in `./backups` and in the bucket
- [ ] `.env` stored in the password manager
- [ ] Hetzner server backups on
- [ ] Customer recorded in the control panel: server, IP, domain, version, bucket

## Routine work

**Upgrading** (after a release, during the customer's quiet hours):

```bash
ssh root@<server-ip> 'cd /opt/chatboat/deploy && ./upgrade.sh 1.3.0'
```

**Monthly:**

- Look at `docker compose logs --since 720h backup | grep -i fail`.
- Check disk use with `df -h /`. Above 70 %, resize the server or add a volume.
- Apply OS updates (`unattended-upgrades` handles security fixes). Reboot when needed, because the stack restarts by itself.

**Quarterly:** restore the newest S3 backup on a throwaway server (the same steps as "Moving to a new server" in `README.md`). Check that the data is there, then delete the server.

## When a server is lost

1. Create a new server (steps 1–2). Reuse the domain and point DNS at the new IP.
2. Copy `deploy/` and the customer's `.env` from the password manager to `/opt/chatboat/deploy/`.
3. Run `./install.sh` (it keeps the `.env`), then `./restore.sh --from-s3 <newest dump>`.
4. Alternatively, restore the whole disk from a Hetzner server backup or snapshot. This is quicker, but loses up to a day of data.

## Offboarding a customer

1. Take a final backup and hand it to the customer if the contract says so.
2. Delete the server, its backups and snapshots, the bucket, and the DNS records.
3. Delete the `.env` and the S3 keys from the password manager once the retention period in the contract has passed.
