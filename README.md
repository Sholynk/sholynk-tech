# Sholynk Technology

Sholynk Technology is a dynamic publication built with Node.js, Express and SQLite. Express serves the application, the public API and a small allowlist of presentation assets. SQLite is the only public runtime source for articles, authors, settings, subscriptions, contact messages, reactions, comments and read analytics.

The project does **not** contain static article exports, JSON content snapshots, a generated search index, offline comment queues or local reaction/comment stores. Clean article pages are server-rendered from the current database row on every request. `/sitemap.xml` and `/robots.txt` are also generated at request time from the configured public origin and current published rows.

## Documentation

- [Oracle Cloud Always Free deployment](docs/ORACLE_CLOUD_ALWAYS_FREE_DEPLOYMENT.md) — complete VM, storage, HTTPS, backup, update and recovery procedure.
- [GitHub and cloud storage map](docs/GITHUB_AND_CLOUD_STORAGE_MAP.md) — exact source, deployment, secret, database, upload, log and backup locations.
- [Hosting when the Oracle card check fails](docs/FREE_HOSTING_WITHOUT_A_CARD.md) — card requirements, the fixes for a failed verification, and an honest comparison of the free alternatives.
- [Author and publishing guide](docs/AUTHOR_PUBLISHING_GUIDE.md) — dashboard publishing workflow.
- [Editorial and SEO handover](docs/EDITORIAL_AND_SEO_HANDOVER.md) — dynamic publishing, metadata and operational checks.
- [PDF import and autofill](docs/pdf-import-autofill.md) — contributor submission workflow.

## Runtime architecture

```text
Browser
  ├─ GET / ──> presentation shell + live SQLite settings
  ├─ GET CSS/JS/image presentation assets
  ├─ GET /articles/:slug/ ──> Express server-side renderer ──> SQLite
  ├─ GET /api/articles?... ─────────────────────────────────> SQLite
  ├─ GET /api/authors and /api/settings ────────────────────> SQLite
  ├─ POST forms, comments, reactions and views ─────────────> SQLite
  ├─ GET /uploads/... ──────────────────────────────────────> durable upload directory
  └─ GET /sitemap.xml and /robots.txt ──> live database + SITE_URL
```

Presentation files such as `index.html`, `styles.css`, browser JavaScript, logos and article source images remain static because browsers require assets. They do not contain an alternative copy of mutable content. Express serves only an explicit public allowlist; repository source, Markdown seed files, documentation and secrets are not web-accessible.

## Requirements

- Node.js 22.5 or newer
- npm
- A writable local directory for SQLite and uploads

The application uses Node's built-in `node:sqlite`, which is still reported as experimental by Node 22.

## Local setup

```bash
git clone https://github.com/Sholynk/sholynk-tech.git
cd sholynk-tech
npm ci
cp .env.example .env
```

For local development, change the durable paths in `.env`:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=false
SITE_URL=http://localhost:3000
CMS_DB_FILE=./cms/data/cms.sqlite
CMS_UPLOAD_DIR=./uploads
CMS_ADMIN_TOKEN=replace-with-a-long-random-value
```

Export the values before running Node; Node does not load `.env` automatically:

```bash
set -a
. ./.env
set +a
npm run seed
npm start
```

Open:

- Site: <http://localhost:3000/>
- Admin dashboard: <http://localhost:3000/admin/>
- Health check: <http://localhost:3000/health>

`npm run seed` imports starter data only when the configured article table is empty. It is not part of `npm start`, `npm run build` or deployment. Once initialized, use the dashboard/API for production edits. An intentional administrative re-import is possible with `node cms/seed.js --force`, but it can overwrite matching article fields and should never be used as a routine deployment step.

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Run the Express application. |
| `npm run dev` | Run with Node's watch mode. |
| `npm run seed` | Seed an empty database with starter editorial data. |
| `npm run validate` | Validate version-controlled starter Markdown and its local assets. |
| `npm run build` | Run source validation; no static content is generated. |
| `npm test` | Run API, database, renderer, frontend and portability tests. |
| `npm run check` | Run validation and the complete test suite. |

## Environment variables

| Variable | Local default/expectation | Production purpose |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production`. |
| `HOST` | `0.0.0.0` if unset | Bind address. Use `127.0.0.1` behind a same-VM reverse proxy. |
| `PORT` | `3000` | Internal HTTP port. |
| `TRUST_PROXY` | unset | Use `1` with one trusted local reverse proxy. |
| `SITE_URL` | request origin if unset | Final absolute public origin for canonicals, sharing, sitemap and notification links. Set it in production. |
| `CMS_ADMIN_TOKEN` | optional for local work | Long random token required for protected API/dashboard operations. |
| `CMS_DB_FILE` | `cms/data/cms.sqlite` | SQLite path; put it on durable storage. |
| `CMS_UPLOAD_DIR` | `uploads/` | CMS media path; put it on the same durable volume. |
| `CMS_REQUIRE_APPROVAL` | `false` | When true, contributor submissions remain pending for review. |
| `SHOLYNK_EDITOR_EMAIL` | project editorial address | Notification recipient. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | optional | SMTP delivery for editorial notifications. Without SMTP, notification records are appended to `notifications.log` beside the database. |

Use `.env.example` only as a template. Never commit a populated `.env` or a real admin/SMTP credential.

## Dynamic content behavior

### Homepage and search

`index.js` retrieves current published articles, hero entries and settings from `/api`. Each category or text search sends a fresh API query, and SQLite performs the filtering. If the service is unavailable, the page displays a clear error; it never substitutes checked-in content.

### Articles

`GET /articles/:slug/` performs these operations at request time:

1. retrieves the published row from SQLite;
2. follows a permanent slug redirect when the article was renamed;
3. renders sanitized Markdown/HTML, metadata, JSON-LD, author and related articles;
4. returns the complete crawlable HTML page;
5. enhances table-of-contents, sharing and engagement controls in the browser.

The old `article.html?slug=...` URL is retained only as a permanent redirect to the clean route. `article.html` itself is a presentation template and is not a content source.

### Engagement and forms

- Reactions, comments and views use `/api/articles/:slug/...` and SQLite.
- The browser stores only an anonymous voter identifier. It does not store reaction counts, comments or an offline queue.
- Newsletter and contact forms POST to `/api/subscriptions` and `/api/contact`.
- Subscriptions and contact messages are available only through protected management routes.
- If a write fails, the UI reports the failure instead of pretending that data was durably saved.

### Discovery metadata

- `/robots.txt` is generated by Express and points at the current sitemap origin.
- `/sitemap.xml` contains static informational routes plus current published, internal long-form articles from SQLite.
- Draft, pending, scheduled, empty-body and external-link entries are excluded.
- Article canonical, Open Graph, Twitter and schema metadata are server-rendered from current records.

## Public API summary

Public reads:

```text
GET  /health
GET  /api/articles?status=published&category=&q=&hero=true
GET  /api/articles/:idOrSlug
GET  /api/articles/categories
GET  /api/authors
GET  /api/settings
GET  /api/articles/:slug/engagement?voterId=...
```

Public writes:

```text
POST /api/subscriptions
POST /api/contact
POST /api/articles/:slug/reactions
POST /api/articles/:slug/comments
POST /api/articles/:slug/views
POST /api/submissions
```

Article, author, settings, image, subscriber, contact-message, moderation and analytics management routes require `CMS_ADMIN_TOKEN` when configured. Send it as `x-admin-token` rather than placing it in URLs or source files.

## Persistence rules

In production, these paths must be outside the Git checkout and on durable storage:

```text
/data/cms.sqlite
/data/cms.sqlite-wal       # may exist while the process is running
/data/cms.sqlite-shm       # may exist while the process is running
/data/uploads/
/data/notifications.log    # when SMTP is not configured
/data/backups/             # local backup staging only
```

The VM checkout and `node_modules/` are replaceable. `/data` is not. A normal deploy must never run the seed importer or remove `/data`.

## Recommended free host

The recommended no-cost target is an **Oracle Cloud Always Free Ampere A1 VM with an attached Always Free block volume**. It can run the complete Express backend and keeps SQLite/uploads on persistent storage across application restarts and code deployments. Free capacity and eligibility are account/region dependent, and idle instances may be reclaimed, so the recommendation depends on disciplined volume/off-account backups. See the detailed Oracle guide before provisioning.

Oracle requires a verifiable card at sign-up: a credit card or a debit card that functions like one. PIN-based, prepaid, single-use and virtual cards are rejected. If that check fails, read [docs/FREE_HOSTING_WITHOUT_A_CARD.md](docs/FREE_HOSTING_WITHOUT_A_CARD.md) before changing hosts — it lists the checks that fix most failures, the support escalation, and an honest comparison of the free alternatives. Most "no card required" hosts cannot keep SQLite and uploads across redeploys, and the genuinely free, no-card alternative (Cloudflare Workers + D1) needs a runtime port rather than a redeploy.

A service with an ephemeral filesystem is not suitable for this SQLite/upload architecture unless it also supplies a durable disk within the selected plan.

## Docker

The provider-neutral image runs as the unprivileged `node` user and expects a durable mount at `/data`:

```bash
docker build -t sholynk-tech .
docker run --rm -p 3000:3000 \
  --env-file .env \
  -v sholynk-data:/data \
  sholynk-tech
```

Initialize a new empty volume once:

```bash
docker run --rm --env-file .env -v sholynk-data:/data sholynk-tech npm run seed
```

Do not rely on a container filesystem for SQLite or uploads.

## Validation before release

```bash
npm ci
npm run check
npm audit --omit=dev
git diff --check
```

Then smoke-test the running deployment:

```bash
curl -fsS https://your-domain.example/health
curl -fsS https://your-domain.example/sitemap.xml | head
curl -I https://your-domain.example/articles/a-published-slug/
```

See the Oracle deployment guide for backup-first updates, rollback and disaster recovery.
