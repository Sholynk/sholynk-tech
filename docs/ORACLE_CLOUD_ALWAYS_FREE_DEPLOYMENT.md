# Deploy Sholynk Technology on an Oracle Cloud Always Free VM

This guide deploys the dynamic Express/SQLite application to an ARM-based Oracle Cloud Infrastructure (OCI) VM. It keeps replaceable application code on the boot volume and all irreplaceable runtime data on a separately attached block volume mounted at `/data`.

> **Important:** OCI service names, quotas and free-tier availability can change. In every creation screen, confirm that the selected resource is labelled **Always Free eligible** and review the estimated monthly cost before clicking Create. Capacity for Ampere A1 shapes is not guaranteed. Oracle also documents that idle Always Free compute instances can be reclaimed. Keep tested backups outside the instance.

## Target layout

```text
Internet
   |
DNS A/AAAA record
   |
OCI public IP: TCP 80 and 443
   |
Caddy (automatic HTTPS)
   |
127.0.0.1:3000
   |
Node/Express in systemd
   |                         Git checkout (replaceable)
   +--> /opt/sholynk-tech/   on the boot volume
   |
   +--> /data/cms.sqlite     on an attached block volume
   +--> /data/uploads/
   +--> /data/backups/
```

The process runs as an unprivileged `sholynk` system account. Caddy is the only public web listener. Port 3000 is never opened in OCI or UFW.

Official references to check before provisioning:

- [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [OCI Free Tier overview and home region](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [Launching a compute instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)
- [Block Volume overview and durability](https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/overview.htm)

---

## 1. Create and secure the OCI account

1. Open Oracle Cloud Free Tier and create an account.
2. Use an email address and phone number that the site owner controls long-term.
3. Complete Oracle's identity/payment verification. Verification does not change the need to check the cost estimate for every resource.
4. Enable multi-factor authentication for the root/administrator account immediately:
   - open the profile menu;
   - go to **My profile / Security**;
   - enroll an authenticator or passkey;
   - save recovery codes offline.
5. Create a daily or monthly budget alert even when only free resources are intended:
   - **Billing & Cost Management → Budgets → Create budget**;
   - choose the root compartment;
   - use a very small threshold, such as US$1;
   - add the owner's monitored email address.
6. Prefer a separate least-privileged OCI administrator identity for daily work rather than routine use of the tenancy owner.

### If payment verification fails

Oracle will not finish creating the account without a card it can verify. Common blockers and the escalation path are documented in [FREE_HOSTING_WITHOUT_A_CARD.md](FREE_HOSTING_WITHOUT_A_CARD.md), including:

- why a PIN-based, prepaid, single-use or virtual debit card is rejected while a bank-issued card that functions like a credit card is accepted;
- the bank-side switches that must be enabled (international online payments and 3-D Secure);
- how to ask Oracle support chat for manual verification.

If no verifiable card can be obtained, that document also compares the remaining free targets and states plainly which ones cannot run this SQLite/uploads architecture.

### Choose the home region carefully

The home region is effectively permanent for core identity resources and Always Free resources are tied to region availability.

1. Compare latency from Lagos to the regions offered during signup. Johannesburg is often geographically sensible for West African traffic, but test and verify the current region list rather than assuming it is available.
2. Confirm in Oracle's current Free Tier documentation that the candidate home region can offer the `VM.Standard.A1.Flex` Always Free shape.
3. Consider Ampere capacity. A nearby region with no A1 capacity is less useful than a slightly farther eligible region where an instance can actually be created.
4. Select the home region only after those checks.

If the console later reports **Out of host capacity**, retry another availability domain or fault domain in the same home region, use a smaller A1 allocation, or try later. Do not select a paid shape accidentally.

---

## 2. Create the network

The console's **Start VCN Wizard** is the simplest safe baseline.

1. Go to **Networking → Virtual cloud networks**.
2. Click **Start VCN Wizard → Create VCN with Internet Connectivity**.
3. Name it `sholynk-vcn`.
4. Use a private range such as `10.0.0.0/16`.
5. Create one public subnet, for example `10.0.0.0/24`.
6. Confirm that the wizard creates:
   - an Internet Gateway;
   - a route table with `0.0.0.0/0` routed to that gateway;
   - a public subnet that permits public IPv4 assignment.

### Network Security Group

Create an NSG named `sholynk-web-nsg` and attach it to the VM's VNIC.

Ingress rules:

| Source | Protocol | Destination port | Purpose |
|---|---:|---:|---|
| your current public IP `/32` | TCP | 22 | SSH administration |
| `0.0.0.0/0` | TCP | 80 | HTTP and certificate validation |
| `0.0.0.0/0` | TCP | 443 | HTTPS |

If IPv6 is enabled, add equivalent `::/0` rules for 80/443 only after configuring the instance and DNS for IPv6.

Do **not** open:

- port 3000;
- SQLite or any database port;
- unrestricted SSH unless a changing administrator IP makes it temporarily unavoidable.

OCI has both security lists and NSGs. Traffic must be allowed by the controls attached to the VNIC/subnet and by the VM firewall. Avoid broad duplicate rules in the default security list.

---

## 3. Create the ARM instance

1. Open **Compute → Instances → Create instance**.
2. Name it `sholynk-web-1`.
3. Select the compartment and `sholynk-vcn` public subnet.
4. Choose an Ubuntu ARM64 image, preferably the current OCI-supported Ubuntu 24.04 LTS Minimal or Ubuntu 22.04 LTS image.
5. Click **Change shape**:
   - shape series: Ampere;
   - shape: `VM.Standard.A1.Flex`;
   - verify **Always Free eligible**;
   - start conservatively with **1 OCPU and 6 GB RAM**. This is enough for this application and leaves headroom inside the free allocation described in Oracle's current account console.
6. Use a boot volume size that keeps total boot plus block storage inside the Always Free storage allowance. For example, use a 50 GB boot volume and later a 50 GB data volume.
7. Generate a dedicated Ed25519 SSH key locally if one does not already exist:

   ```bash
   ssh-keygen -t ed25519 -a 100 -f ~/.ssh/sholynk-oci -C "sholynk-oci"
   ```

8. Upload or paste `~/.ssh/sholynk-oci.pub`. Never upload the private key.
9. Assign a public IPv4 address.
10. Attach `sholynk-web-nsg`.
11. Review the cost estimate and Always Free labels, then create the instance.
12. Record:
    - instance OCID;
    - availability domain;
    - private IP;
    - public IP.

A reserved public IP is preferable because DNS survives instance replacement. In **Networking → IP management / Reserved public IPs**, reserve and assign one only after confirming the current free allowance and cost estimate. Otherwise, document that DNS must be updated when an ephemeral address changes.

Connect:

```bash
chmod 600 ~/.ssh/sholynk-oci
ssh -i ~/.ssh/sholynk-oci ubuntu@PUBLIC_IP
```

---

## 4. Create and mount durable block storage

A separate block volume makes it possible to replace the VM without treating the Git checkout as a database backup.

### In the OCI console

1. Go to **Storage → Block Storage → Block Volumes → Create block volume**.
2. Name it `sholynk-data`.
3. Put it in the same availability domain as the instance.
4. Choose a size such as 50 GB while keeping boot + block volumes within the current Always Free aggregate allowance.
5. Verify the cost estimate and create it.
6. Open the volume, click **Attached Instances → Attach to instance**.
7. Choose `sholynk-web-1` and **Paravirtualized** attachment.
8. Use the console-provided Linux attachment instructions when they differ from the commands below.

### On the VM

Install tools and identify the new blank disk:

```bash
sudo apt update
sudo apt install -y util-linux e2fsprogs
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS,MODEL
```

Assume the new device is `/dev/sdb` in the commands below. **Verify it with `lsblk`; formatting the wrong device destroys data.**

If and only if it is a new blank volume:

```bash
sudo mkfs.ext4 -L sholynk-data /dev/sdb
sudo mkdir -p /data
sudo blkid /dev/sdb
```

Copy the UUID shown by `blkid`, then add this line to `/etc/fstab`:

```fstab
UUID=REPLACE_WITH_ACTUAL_UUID /data ext4 defaults,nofail,x-systemd.device-timeout=30 0 2
```

Mount and verify:

```bash
sudo mount -a
findmnt /data
sudo touch /data/.write-test && sudo rm /data/.write-test
```

Never run `mkfs` again on a volume containing production data.

---

## 5. Harden Ubuntu

### Patch and install baseline packages

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y \
  ca-certificates curl git sqlite3 ufw fail2ban unattended-upgrades \
  jq tar rsync
sudo reboot
```

Reconnect after the reboot.

### Create the service identity and directories

```bash
sudo adduser --system --group --home /var/lib/sholynk sholynk
sudo install -d -o sholynk -g sholynk -m 0750 /data/uploads /data/backups
sudo install -d -o root -g sholynk -m 0750 /etc/sholynk
sudo install -d -o sholynk -g sholynk -m 0755 /opt/sholynk-tech
```

### Firewall

Keep the current SSH session open while testing firewall changes:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

From a second terminal, verify that SSH still works before closing the first.

### SSH hardening

First verify key authentication in a second session. Then create `/etc/ssh/sshd_config.d/99-sholynk.conf`:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowTcpForwarding no
MaxAuthTries 4
```

Validate and reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

If SSH access needs port forwarding for another legitimate administration task, omit `AllowTcpForwarding no` rather than weakening unrelated settings.

### Automatic security updates

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
systemctl status unattended-upgrades --no-pager
```

Schedule controlled reboots for kernel updates; automatic package installation does not guarantee that a new kernel is active.

---

## 6. Install Node.js 22

Install the current Node 22 LTS build for ARM64 from a trusted distribution source. One common method is NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
less /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
rm /tmp/nodesource_setup.sh
node --version
npm --version
uname -m
```

Expected architecture is `aarch64`. Node must be at least 22.5 because the application uses `node:sqlite`.

If organisational policy does not allow repository bootstrap scripts, install the signed Node.js ARM64 binary/package through the organisation's normal package management process instead. Do not use an unmaintained distro Node release.

---

## 7. Check out the repository

For a public repository:

```bash
sudo -u sholynk git clone \
  https://github.com/Sholynk/sholynk-tech.git \
  /opt/sholynk-tech
cd /opt/sholynk-tech
sudo -u sholynk git checkout YOUR_PRODUCTION_BRANCH
sudo -u sholynk npm ci
sudo -u sholynk npm run check
sudo -u sholynk npm prune --omit=dev
```

Replace `YOUR_PRODUCTION_BRANCH` with the reviewed branch/tag being deployed. Deploy an immutable tag or commit for repeatable releases when possible.

For a private repository, use a read-only GitHub deploy key assigned only to this repository. Store the private key under `/var/lib/sholynk/.ssh/` with mode `0600` and owner `sholynk`. Do not put a GitHub token in the repository, `.env`, shell history or systemd unit.

Everything tracked by Git is copied into `/opt/sholynk-tech`; see [the storage map](GITHUB_AND_CLOUD_STORAGE_MAP.md). `node_modules/` is generated by `npm ci` on the ARM VM and must not be copied from a developer machine.

---

## 8. Configure environment and secrets

Generate an admin token:

```bash
openssl rand -hex 32
```

Create `/etc/sholynk/sholynk.env`:

```bash
sudoedit /etc/sholynk/sholynk.env
```

Example:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=1
SITE_URL=https://example.com
CMS_ADMIN_TOKEN=REPLACE_WITH_RANDOM_64_HEX_CHARACTERS
CMS_DB_FILE=/data/cms.sqlite
CMS_UPLOAD_DIR=/data/uploads
CMS_REQUIRE_APPROVAL=true
SHOLYNK_EDITOR_EMAIL=editor@example.com
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Protect it:

```bash
sudo chown root:sholynk /etc/sholynk/sholynk.env
sudo chmod 0640 /etc/sholynk/sholynk.env
```

Rules:

- never copy this file into `/opt/sholynk-tech`;
- never commit it;
- do not use a query-string admin token in bookmarks or logs;
- rotate the admin token and SMTP password after suspected exposure;
- use SMTP provider app credentials, not the owner's primary mailbox password.

### Seed only a brand-new database

Confirm the target is empty/nonexistent:

```bash
sudo test ! -e /data/cms.sqlite && echo "new database" || echo "database already exists"
```

For the first deployment only, load the root-protected environment in a temporary root shell and then drop privileges for the importer:

```bash
sudo bash -c '
  set -a
  . /etc/sholynk/sholynk.env
  set +a
  runuser -u sholynk -- /usr/bin/npm --prefix /opt/sholynk-tech run seed
'
```

After seeding:

```bash
sudo -u sholynk test -s /data/cms.sqlite
sudo -u sholynk sqlite3 /data/cms.sqlite 'PRAGMA integrity_check;'
```

Expected result: `ok`.

**Never run seed during normal startup or redeployment.** Production dashboard edits live only in SQLite.

---

## 9. Create the systemd service

Create `/etc/systemd/system/sholynk.service`:

```ini
[Unit]
Description=Sholynk Technology web application
After=network-online.target data.mount
Wants=network-online.target
RequiresMountsFor=/data

[Service]
Type=simple
User=sholynk
Group=sholynk
WorkingDirectory=/opt/sholynk-tech
EnvironmentFile=/etc/sholynk/sholynk.env
ExecStart=/usr/bin/node /opt/sholynk-tech/cms/server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM
UMask=0027

NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
ReadWritePaths=/data

# Adjust only after measuring a legitimate need.
MemoryMax=1G
TasksMax=256

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sholynk
sudo systemctl status sholynk --no-pager
sudo journalctl -u sholynk -n 100 --no-pager
curl -fsS http://127.0.0.1:3000/health | jq
```

Expected health fields include `"ok": true` and `"database": true`.

If the service cannot write data, verify `/data` ownership, `CMS_DB_FILE`, `CMS_UPLOAD_DIR`, `ReadWritePaths` and the block-volume mount before relaxing systemd protections.

---

## 10. Configure DNS

At the DNS provider:

1. Create an `A` record for the apex (`@`) pointing to the OCI public IPv4 address.
2. Create either:
   - an `A` record for `www` to the same address; or
   - a `CNAME` from `www` to the apex, if the provider supports it.
3. Remove conflicting old `A`, `AAAA` or `CNAME` records.
4. Use a short TTL (for example 300 seconds) during migration, then raise it later.
5. If an `AAAA` record exists, ensure IPv6 routing/firewall actually works; otherwise remove it because clients may prefer the broken IPv6 path.

Check propagation:

```bash
dig +short example.com A
dig +short www.example.com A
```

Do not request a certificate until both names resolve to the VM and ports 80/443 are reachable.

---

## 11. Install Caddy and enable HTTPS

Caddy is recommended because it automatically obtains and renews certificates. Install it from Caddy's official signed Debian repository, following the current instructions at <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>.

At the time of writing, the flow is:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Always compare those commands to Caddy's current official page before running them.

Create `/etc/caddy/Caddyfile`:

```caddyfile
example.com, www.example.com {
    encode zstd gzip

    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        X-Frame-Options SAMEORIGIN
        -Server
    }

    reverse_proxy 127.0.0.1:3000

    log {
        output journal
        format json
    }
}
```

Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo journalctl -u caddy -n 100 --no-pager
```

Test:

```bash
curl -I http://example.com/
curl -fsS https://example.com/health | jq
curl -I https://example.com/articles/the-rise-of-quantum-computing/
curl -fsS https://example.com/robots.txt
curl -fsS https://example.com/sitemap.xml | head
```

HTTP should redirect to HTTPS. Do not configure Caddy to serve `/opt/sholynk-tech` directly; all requests must go through Express so dynamic routes and the static-file allowlist remain enforced.

---

## 12. Configure backups

A block volume is durable storage, not a backup. Protect against accidental deletion, corrupt writes, compromised credentials and regional failures.

### Consistent daily SQLite and upload backup

Create `/usr/local/sbin/sholynk-backup`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_DIR=/data/backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WORK="$BACKUP_DIR/$STAMP"
mkdir -p "$WORK"

# Pause writes briefly so the database and upload directory represent the same
# recovery point. The trap always brings the application back after an error.
systemctl stop sholynk
trap 'systemctl start sholynk' EXIT

sqlite3 /data/cms.sqlite ".timeout 10000" ".backup '$WORK/cms.sqlite'"
sqlite3 "$WORK/cms.sqlite" 'PRAGMA integrity_check;' | grep -qx ok
tar -C /data -czf "$WORK/uploads.tar.gz" uploads
sha256sum "$WORK/cms.sqlite" "$WORK/uploads.tar.gz" > "$WORK/SHA256SUMS"

systemctl start sholynk
trap - EXIT

# Local copies are convenient for quick recovery but are not the off-instance copy.
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf -- {} +
```

The script deliberately excludes `/etc/sholynk/sholynk.env`. Keep secret recovery material in an approved password/secret manager. Encrypt every off-machine data backup with a tool such as `restic`, `age` or a properly configured encrypted object-storage client.

Install and protect:

```bash
sudo chmod 0750 /usr/local/sbin/sholynk-backup
sudo chown root:root /usr/local/sbin/sholynk-backup
```

Create `/etc/systemd/system/sholynk-backup.service`:

```ini
[Unit]
Description=Back up Sholynk SQLite and uploads
RequiresMountsFor=/data

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/sholynk-backup
```

Create `/etc/systemd/system/sholynk-backup.timer`:

```ini
[Unit]
Description=Daily Sholynk backup

[Timer]
OnCalendar=*-*-* 02:15:00 UTC
RandomizedDelaySec=20m
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and test:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sholynk-backup.timer
sudo systemctl start sholynk-backup.service
sudo systemctl status sholynk-backup.service --no-pager
sudo systemctl list-timers sholynk-backup.timer
sudo find /data/backups -maxdepth 2 -type f -ls
```

### OCI volume backups

1. Open the `sholynk-data` block volume.
2. Create a manual backup after initial deployment and before risky upgrades.
3. Configure a policy-based schedule if it fits the account's Always Free backup allowance.
4. Retain at least one known-good backup older than the most recent deployment.
5. Verify current quotas; Oracle's published Always Free documentation has historically included a limited number of volume backups.

### Off-instance encrypted copy

At least daily, copy the backup set to one of:

- encrypted OCI Object Storage in a different failure domain/region if available within the current free allowance;
- an encrypted repository managed by `restic` on another provider/account;
- encrypted owner-controlled offline storage.

A copy in `/data/backups` and a backup of the same OCI volume do not by themselves protect against loss of the entire OCI account. Test a restore quarterly.

---

## 13. Monitoring and logs

### Service checks

```bash
systemctl is-active sholynk caddy
curl -fsS http://127.0.0.1:3000/health | jq
curl -fsS https://example.com/health | jq
df -h / /data
free -h
sudo journalctl -u sholynk --since '1 hour ago'
sudo journalctl -u caddy --since '1 hour ago'
```

Make journald persistent by creating `/etc/systemd/journald.conf.d/persistent.conf`:

```ini
[Journal]
Storage=persistent
SystemMaxUse=500M
MaxRetentionSec=14day
```

Then:

```bash
sudo systemctl restart systemd-journald
```

Logs remain VM runtime state under `/var/log/journal`; they do not belong in Git or `/data` backups unless an audit policy requires exporting them.

### OCI and external alerts

Configure:

- OCI Monitoring alarms for high CPU, memory (when the compute agent reports it), boot-volume use and instance availability;
- a Billing budget alert;
- an external HTTPS monitor against `/health` every five minutes;
- certificate-expiry monitoring even though Caddy renews automatically;
- a backup timer failure alert or a daily check that a recent backup directory exists.

Oracle may reclaim Always Free compute it determines to be idle under the current policy. Do not manufacture meaningless load. Instead, monitor the instance, keep data on recoverable storage, and maintain the documented recovery procedure.

---

## 14. Safe redeployment

A deployment changes code on the boot volume and does not touch `/data`.

### Before every deployment

```bash
sudo systemctl start sholynk-backup.service
sudo -u sholynk sqlite3 /data/cms.sqlite 'PRAGMA integrity_check;'
curl -fsS https://example.com/health | jq
```

### Update and validate

```bash
cd /opt/sholynk-tech
sudo -u sholynk git fetch --prune origin
sudo -u sholynk git status --short
sudo -u sholynk git checkout YOUR_PRODUCTION_BRANCH
sudo -u sholynk git pull --ff-only origin YOUR_PRODUCTION_BRANCH
sudo -u sholynk npm ci
sudo -u sholynk npm run check
sudo -u sholynk npm prune --omit=dev
sudo systemctl restart sholynk
sudo systemctl status sholynk --no-pager
curl -fsS http://127.0.0.1:3000/health | jq
curl -fsS https://example.com/health | jq
```

Do not run `npm run seed`. Database migrations in `cms/lib/db.js` are additive and run when the new application starts.

If `git status` is not clean, stop and investigate. Do not use `git reset --hard` as a routine deployment command because it can hide unauthorized or accidental VM changes.

### Roll back code

Record the old commit before an update:

```bash
cd /opt/sholynk-tech
git rev-parse HEAD
```

To roll back:

```bash
sudo systemctl stop sholynk
cd /opt/sholynk-tech
sudo -u sholynk git checkout OLD_KNOWN_GOOD_COMMIT
sudo -u sholynk npm ci --omit=dev
sudo systemctl start sholynk
curl -fsS http://127.0.0.1:3000/health | jq
```

Because migrations are additive, a code rollback normally leaves new columns/tables in place. If a future release introduces a non-compatible migration, its release notes must include a database rollback procedure.

---

## 15. Restore and disaster recovery

### Restore a database on the existing VM

1. Put the site in maintenance or stop writes:

   ```bash
   sudo systemctl stop sholynk
   ```

2. Preserve the damaged/current files:

   ```bash
   RECOVERY_DIR="/data/recovery-$(date -u +%Y%m%dT%H%M%SZ)"
   sudo mkdir -p "$RECOVERY_DIR"
   sudo find /data -maxdepth 1 -type f -name 'cms.sqlite*' -exec mv -t "$RECOVERY_DIR" -- {} +
   ```

3. Copy the selected backup database to `/data/cms.sqlite`.
4. Restore `uploads/` from the matching archive if needed.
5. Set ownership and permissions:

   ```bash
   sudo chown -R sholynk:sholynk /data/cms.sqlite /data/uploads
   sudo chmod 0640 /data/cms.sqlite
   sudo find /data/uploads -type d -exec chmod 0750 {} +
   sudo find /data/uploads -type f -exec chmod 0640 {} +
   ```

6. Validate and start:

   ```bash
   sudo -u sholynk sqlite3 /data/cms.sqlite 'PRAGMA integrity_check;'
   sudo systemctl start sholynk
   curl -fsS http://127.0.0.1:3000/health | jq
   ```

### Recover after instance loss

1. Create a replacement ARM instance in the same region/availability domain where the data volume can be attached.
2. Apply network, OS and SSH hardening from this guide.
3. Attach the existing `sholynk-data` volume or restore a new volume from its OCI backup.
4. Mount it at `/data` by UUID; do not format it.
5. Reinstall Node and Caddy.
6. Clone the reviewed application commit into `/opt/sholynk-tech` and run `npm ci --omit=dev`.
7. Restore `/etc/sholynk/sholynk.env` from the encrypted secret backup or secret manager.
8. Recreate the systemd and Caddy units.
9. Start the application and verify integrity/health.
10. Reassign the reserved public IP, or update DNS to the new ephemeral address.
11. Exercise article reads, admin authentication, uploads, reactions, comments, subscription and contact forms.
12. Create a new known-good volume backup.

### Recovery acceptance checklist

- `PRAGMA integrity_check` returns `ok`.
- `/health` returns `ok: true` and `database: true`.
- a published clean article route returns HTTP 200 with current content.
- `/sitemap.xml` uses the production origin and includes current published articles.
- an uploaded image is readable.
- a test comment/reaction survives process restart.
- dashboard write access requires the current admin token.
- Caddy serves a valid certificate.
- the backup timer is enabled and a test backup succeeds.

---

## 16. Final production checklist

- [ ] Every selected OCI resource is marked Always Free eligible and has a zero expected cost.
- [ ] Account MFA and budget alerts are enabled.
- [ ] SSH is key-only and restricted by source IP where practical.
- [ ] OCI NSG and UFW expose only 22, 80 and 443.
- [ ] Node listens only on `127.0.0.1:3000`.
- [ ] `/data` is a separately attached, auto-mounted block volume.
- [ ] `CMS_DB_FILE` and `CMS_UPLOAD_DIR` point into `/data`.
- [ ] `/etc/sholynk/sholynk.env` is mode `0640`, outside Git and not web-accessible.
- [ ] `SITE_URL` exactly matches the canonical HTTPS origin.
- [ ] `CMS_ADMIN_TOKEN` is random and not present in source, URLs or logs.
- [ ] The database was seeded only once, before live editing.
- [ ] systemd starts the service after reboot and restarts it on failure.
- [ ] Caddy serves valid HTTPS and proxies to Express.
- [ ] DNS records point only to the current public IP.
- [ ] Daily consistent backups, OCI volume backups and an encrypted off-account copy exist.
- [ ] A restore has been tested.
- [ ] External health, resource, certificate and backup monitoring is active.
- [ ] The exact deployed Git commit and recovery contacts are recorded.
