# GitHub and Oracle Cloud storage map

This document defines where every class of file in the current project belongs. The governing rule is:

- **GitHub contains reproducible source and starter editorial material.**
- **The VM boot volume contains a disposable checkout and generated dependencies.**
- **The attached `/data` volume contains all live mutable application data.**
- **Secrets and operational logs stay outside both Git and the public application tree.**

A deployment clones the repository to `/opt/sholynk-tech`. It does not selectively upload a frontend bundle. All tracked source reaches the VM, but Express exposes only an explicit public allowlist.

## 1. Source-controlled files in GitHub

These files must be reviewed and committed.

### Application and dependency contract

```text
/home/user/sholynk-tech/package.json
/home/user/sholynk-tech/package-lock.json
/home/user/sholynk-tech/Dockerfile
/home/user/sholynk-tech/.dockerignore
/home/user/sholynk-tech/.env.example
/home/user/sholynk-tech/.gitignore
/home/user/sholynk-tech/LICENSE
```

Purpose:

- `package.json` and `package-lock.json` pin application dependencies and commands.
- `Dockerfile` is a provider-neutral container option; the OCI VM guide runs Node directly.
- `.env.example` documents variable names and safe placeholder values. It is not a secret file.
- `.gitignore` excludes runtime database, uploads, notifications, dependencies and real environment files.

### Static presentation shells and browser code

```text
/home/user/sholynk-tech/index.html
/home/user/sholynk-tech/article.html
/home/user/sholynk-tech/about.html
/home/user/sholynk-tech/contact.html
/home/user/sholynk-tech/help_&_support.html
/home/user/sholynk-tech/privacy_policy.html
/home/user/sholynk-tech/styles.css
/home/user/sholynk-tech/index.js
/home/user/sholynk-tech/article.js
/home/user/sholynk-tech/cms-client.js
/home/user/sholynk-tech/engagement.js
/home/user/sholynk-tech/script.js
/home/user/sholynk-tech/cookie-consent.js
```

These are source-controlled presentation assets. They contain structure, styling and browser behavior, not a backup copy of published articles or engagement data.

Important boundaries:

- `article.html` is a template consumed by the server-side renderer.
- `cms-client.js` calls the live API and has no JSON fallback.
- `engagement.js` sends reactions/comments/views to the live API. It stores only an anonymous voter ID in browser localStorage.
- `index.js` performs homepage category/search behavior on live API results.

### Application server, CMS and tests

```text
/home/user/sholynk-tech/cms/server.js
/home/user/sholynk-tech/cms/routes/api.js
/home/user/sholynk-tech/cms/lib/*.js
/home/user/sholynk-tech/cms/seed.js
/home/user/sholynk-tech/cms/validate-content.js
/home/user/sholynk-tech/cms/admin/index.html
/home/user/sholynk-tech/cms/admin/admin.css
/home/user/sholynk-tech/cms/admin/admin.js
/home/user/sholynk-tech/cms/tests/*.test.js
```

This includes:

- Express routes and explicit static-file allowlist;
- SQLite migrations and data access;
- live server-side article rendering (`cms/lib/article-page.js`);
- authors, settings, forms, engagement, analytics, notifications, images and PDF import;
- protected admin dashboard;
- automated validation.

`cms/lib/db.js` creates/adds schema at runtime but the JavaScript migration source belongs in Git.

### Starter editorial source

```text
/home/user/sholynk-tech/article_stories/*.md
/home/user/sholynk-tech/cms/data/seed.json
```

These files are allowed in Git only as **starter/import material for a brand-new database**:

- `article_stories/*.md` contains long-form starter stories and metadata.
- `cms/data/seed.json` contains initial card/hero records and initial settings.
- `npm run seed` reads them only when the configured article table is empty.
- `npm start` and deployment do not read them as a public content fallback.
- After initial import, the production SQLite database is authoritative.
- Routine redeployment must never force-import these files over dashboard edits.

If the editorial team wants a database article reflected back into Git, that is a deliberate export/review process, not a runtime requirement.

### Source images and visual assets

```text
/home/user/sholynk-tech/Images and Assets/**
/home/user/sholynk-tech/Article cards images/**
/home/user/sholynk-tech/article-images/**
```

These are curated source assets used by presentation or starter content and therefore belong in Git. They are copied to the VM checkout and served by Express's explicit asset-directory allowlist.

They are different from media uploaded through the CMS after deployment. Runtime uploads belong only in `/data/uploads`.

### Documentation and editor configuration

```text
/home/user/sholynk-tech/README.md
/home/user/sholynk-tech/docs/**
/home/user/sholynk-tech/article_stories/README.md
/home/user/sholynk-tech/.vscode/launch.json
```

Documentation and non-secret editor configuration belong in Git. Documentation reaches the VM because the entire repository is cloned, but Express does not serve `/docs`, `/article_stories` or `.vscode`.

## 2. Files copied to the VM during deployment

The Git checkout is:

```text
/opt/sholynk-tech/
```

`git clone`/`git pull --ff-only` places every tracked path described above under that directory with the same relative structure, for example:

```text
/opt/sholynk-tech/cms/server.js
/opt/sholynk-tech/cms/lib/db.js
/opt/sholynk-tech/index.html
/opt/sholynk-tech/styles.css
/opt/sholynk-tech/article-images/...
/opt/sholynk-tech/package-lock.json
```

The checkout is replaceable:

- it can be recreated from a reviewed Git commit;
- it is not the only copy of any production article/form/comment/upload;
- it should be owned by the `sholynk` service account;
- it should be read-only to the running process under systemd, except that Node reads files from it.

Do not attach `/opt/sholynk-tech` as the persistent data volume. Code rollback and data recovery have different lifecycles.

## 3. Dependencies generated on the VM

This directory is created by `npm ci` and must not be committed or copied from another machine:

```text
/opt/sholynk-tech/node_modules/
```

Why:

- dependencies are reproducible from `package-lock.json`;
- native packages such as `sharp` must be installed for the VM's ARM64 operating system;
- a developer's x86/macOS/Windows `node_modules` can be incompatible;
- it can be deleted and regenerated without data loss.

During release validation the VM can run `npm ci` (including dev dependency `jsdom`), run `npm run check`, then run `npm prune --omit=dev`. Production runtime dependencies remain in `node_modules/`.

Other generated/disposable VM files include npm's global cache and temporary files under `/tmp`; none belong in Git or backups.

## 4. Durable runtime data: cloud only

Configure:

```dotenv
CMS_DB_FILE=/data/cms.sqlite
CMS_UPLOAD_DIR=/data/uploads
```

The separately attached OCI block volume mounted at `/data` contains:

```text
/data/cms.sqlite
/data/cms.sqlite-wal          # transient SQLite WAL sidecar while active
/data/cms.sqlite-shm          # transient SQLite shared-memory sidecar
/data/uploads/
/data/notifications.log       # only when SMTP is unavailable/not configured
/data/backups/
```

### `/data/cms.sqlite`

This is the sole production source of truth for mutable application data:

- articles and slug redirects;
- authors;
- settings;
- image metadata;
- subscriptions;
- contact messages;
- reactions;
- comments;
- view analytics;
- moderation/submission status;
- schema migration state.

It must never be committed, copied into the checkout or replaced by `cms/data/seed.json` during a deploy.

### SQLite sidecar files

`cms.sqlite-wal` and `cms.sqlite-shm` may exist while the service runs. Do not manually delete them from a live database. Use SQLite's online `.backup` command for a transactionally consistent backup rather than copying only `cms.sqlite` while the app is active.

### `/data/uploads/`

This stores media uploaded through the admin/API after deployment. Those files do not exist in Git and must be included in backup/restore alongside the corresponding database.

The repository path `uploads/.gitkeep` is only an empty placeholder for local development. Production `CMS_UPLOAD_DIR` points elsewhere.

### `/data/notifications.log`

When SMTP is not configured, editorial notification records are appended here. It is runtime operational/editorial data and stays on durable storage. If SMTP is configured and policy no longer requires it, it may be absent.

### `/data/backups/`

This is local backup staging. It can hold dated SQLite online backups, compressed upload archives, checksums and encrypted configuration backup material. It must not be committed.

Because `/data/backups` shares the same block volume as live data, it is not sufficient by itself. Replicate encrypted copies off-instance/off-account and configure OCI volume backups.

## 5. Secrets: VM only, outside the checkout

Production secrets belong here:

```text
/etc/sholynk/sholynk.env
```

Recommended ownership and permissions:

```text
owner: root
 group: sholynk
 mode: 0640
```

It contains values such as:

- `CMS_ADMIN_TOKEN`;
- SMTP user/password;
- production `SITE_URL`;
- database/upload paths;
- approval/security settings.

It must not be:

- committed to GitHub;
- stored as `/opt/sholynk-tech/.env`;
- placed in a public HTML/JavaScript file;
- included unencrypted in a backup destination;
- sent in support messages or screenshots.

`.env.example` stays in Git because it contains variable names and placeholders only.

A private-repository deploy key, when required, belongs under:

```text
/var/lib/sholynk/.ssh/
```

It must be read-only, repository-scoped and absent from the application environment file.

## 6. Logs and service state

### Application and reverse-proxy logs

The recommended deployment writes logs to systemd's journal:

```text
/var/log/journal/...
```

Access them with:

```bash
sudo journalctl -u sholynk
sudo journalctl -u caddy
```

Do not create `app.log` or `error.log` inside `/opt/sholynk-tech`. Logs are not source and can make deployments dirty. Configure journald retention and export to a log service only when required.

### Caddy state and certificates

Caddy manages certificates and account state under system locations such as:

```text
/var/lib/caddy/
/etc/caddy/Caddyfile
```

The Caddyfile is VM configuration in the walkthrough, not repository source. Certificates can be reissued from DNS/public reachability; Caddy state should still be protected according to the operator's infrastructure policy.

### systemd units

Operational units live on the VM:

```text
/etc/systemd/system/sholynk.service
/etc/systemd/system/sholynk-backup.service
/etc/systemd/system/sholynk-backup.timer
```

Their reviewed examples are documented in the Oracle guide. They are not currently templated from repository files, so VM configuration management must track changes to them.

## 7. Backup artifacts

Use three layers:

1. **Local quick-restore staging**
   ```text
   /data/backups/<UTC timestamp>/cms.sqlite
   /data/backups/<UTC timestamp>/uploads.tar.gz
   /data/backups/<UTC timestamp>/SHA256SUMS
   ```
2. **OCI block-volume backup** managed in OCI, separate from the running instance.
3. **Encrypted off-instance/off-account backup** stored in another controlled location.

Backup archives do not belong in GitHub. Git has neither the access controls nor the efficient storage model for live databases, user submissions, uploads or secrets.

Record encryption keys/recovery material in the owner's password manager or approved secret manager, not beside the encrypted backup.

## 8. Files that must not exist anymore

The dynamic architecture intentionally removes these former static-host outputs:

```text
/home/user/sholynk-tech/content-fallback.json
/home/user/sholynk-tech/articles.json
/home/user/sholynk-tech/articles/
/home/user/sholynk-tech/generated-images/
/home/user/sholynk-tech/sitemap.xml
/home/user/sholynk-tech/robots.txt
/home/user/sholynk-tech/cms/export-fallback.js
/home/user/sholynk-tech/cms/build-site.js
/home/user/sholynk-tech/article-static.js
/home/user/sholynk-tech/articles.js
/home/user/sholynk-tech/markdown.js
```

Their replacements are:

| Removed output/behavior | Dynamic replacement |
|---|---|
| JSON article snapshot | `/api/articles` backed by SQLite |
| JSON search index | live API results and SQLite query filtering |
| generated `articles/<slug>/index.html` | Express `GET /articles/:slug/` server-side rendering |
| generated responsive derivative directory | curated source image or durable CMS upload served directly |
| checked-in sitemap | runtime `/sitemap.xml` from published database rows |
| checked-in robots file | runtime `/robots.txt` from `SITE_URL` |
| localStorage reaction/comment fallback | live engagement API with explicit failure state |

A CI check or code review should reject any attempt to reintroduce these as an alternate production content path.

## 9. Deployment and recovery matrix

| Item | GitHub | VM boot volume | `/data` block volume | Secret store/config | Backup required |
|---|---:|---:|---:|---:|---:|
| Node/Express source | Yes | Checkout | No | No | Git is recovery source |
| HTML/CSS/browser JS | Yes | Checkout | No | No | Git is recovery source |
| source logos/article images | Yes | Checkout | No | No | Git is recovery source |
| starter Markdown/seed JSON | Yes | Checkout, not runtime public data | No | No | Git is recovery source |
| `node_modules` | No | Generated | No | No | Recreate with `npm ci` |
| production SQLite | No | No | Yes | Path in env | Yes, consistent and offsite |
| production uploads | No | No | Yes | Path in env | Yes, paired with DB |
| admin/SMTP credentials | No | No | No | `/etc/sholynk/sholynk.env` | Encrypted recovery copy |
| application/Caddy logs | No | journald | No | retention config | Optional/policy-based |
| local backup staging | No | No | Yes | No | Copy off-instance |
| TLS state | No | `/var/lib/caddy` | No | Caddy config | Reissuable; policy-based |

## 10. Audit commands

From the repository:

```bash
# Runtime data and secrets should not be tracked.
git ls-files | grep -E '(^|/)(cms\.sqlite|\.env$|notifications\.log|uploads/.+)' || true

# Removed static content mechanisms should be absent.
find . -maxdepth 2 \( \
  -name 'content-fallback.json' -o \
  -name 'articles.json' -o \
  -name 'build-site.js' -o \
  -name 'export-fallback.js' \
\) -print

grep -RniE 'content-fallback|comment-queue|data-prerendered' \
  --exclude-dir=.git --exclude-dir=node_modules . || true
```

On the VM:

```bash
findmnt /data
namei -l /etc/sholynk/sholynk.env
sudo -u sholynk test -r /etc/sholynk/sholynk.env
sudo -u sholynk test -w /data
sudo -u sholynk test ! -w /opt/sholynk-tech/package.json
sudo -u sholynk sqlite3 /data/cms.sqlite 'PRAGMA integrity_check;'
systemctl is-active sholynk caddy
```

The last write-protection check assumes the systemd hardening context or filesystem permissions make the checkout non-writable to the running process. If deployments are performed as `sholynk`, use systemd `ProtectSystem=strict` to enforce runtime read-only access while allowing controlled deployment commands outside the service sandbox.
