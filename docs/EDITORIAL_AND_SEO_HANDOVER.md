# Editorial, SEO and operations handover

## Current publishing model

Sholynk is a dynamic Express/SQLite publication:

- SQLite is authoritative for articles, authors, settings, forms and engagement.
- Clean article pages are server-rendered from current database rows.
- Homepage content/search use the live API.
- Discovery files are runtime routes.
- Browser storage is not a content or engagement database.
- Code deployment and editorial publication are independent.

The former workflow of importing content, exporting JSON and generating article files no longer exists.

## Editorial ownership

Production editors work in `/admin/` and save directly to the configured `CMS_DB_FILE`. A save is live on the next request when status is published; no code commit, build or restart is required.

`article_stories/*.md` and `cms/data/seed.json` are starter/import assets for an empty installation. They do not update or replace live SQLite records during startup or deployment.

## Release workflow

### Content-only publication

1. Verify `/health` is healthy.
2. Sign in to `/admin/` with the protected token.
3. Create/update author and article records.
4. Keep work draft/pending until reviewed.
5. Validate images, sources, metadata and accessibility.
6. Publish.
7. Verify the clean URL, homepage/API and sitemap.
8. Confirm the daily backup process remains healthy.

### Application-code release

1. Create a database/upload backup.
2. Run `npm ci` and `npm run check` on the reviewed commit.
3. Deploy code without running the seed importer.
4. Restart the systemd process.
5. Test health, homepage, article rendering, forms and engagement.
6. Roll back the code commit if needed; do not roll back live content unless the database itself is damaged.

See the Oracle deployment guide for exact commands.

## SEO behavior

### Article responses

Express emits these values from the current SQLite row:

- title and description;
- canonical URL based on `SITE_URL` unless overridden;
- Open Graph and Twitter card tags;
- article publication/modification dates;
- Article, author, publisher and breadcrumb JSON-LD;
- FAQ structured data when visible FAQs exist;
- related articles resolved against current published rows.

Because metadata is in initial server HTML, crawlers do not need browser JavaScript to discover it.

### Sitemap

`GET /sitemap.xml` is generated per request and cached briefly. It contains:

- core informational pages;
- published internal articles with a non-empty body;
- current canonical URLs and modified dates.

It excludes drafts, pending/scheduled records, bodyless entries and external-link entries.

### Robots

`GET /robots.txt` allows public pages, disallows `/admin/` and `/api/`, and points at `SITE_URL/sitemap.xml`.

`SITE_URL` must be set to the final HTTPS origin in production. Never bake a former host into source.

## Author and trust signals

Every article should reference a registered author. Author profiles feed visible cards and structured data. Review:

- accurate name;
- expertise/role;
- concise bio;
- public profile URL;
- image and alt text;
- disclosures where relevant.

Unknown author slugs resolve to the owner to avoid orphaned content, but repeated fallback is an editorial data-quality warning.

## Evidence standards

For each factual article:

- use primary/official sources where possible;
- record source title, publisher, author, date, URL and supported claim;
- separate reporting from opinion;
- date time-sensitive claims;
- avoid unsupported certainty;
- keep visible sources synchronized with structured citations.

## Metadata checklist

- [ ] One clear H1 generated from the article title.
- [ ] Logical H2/H3 outline.
- [ ] Unique SEO title.
- [ ] Accurate description/standfirst.
- [ ] HTTPS canonical or default clean URL.
- [ ] Descriptive hero/body image alt text.
- [ ] Publication/modified date correct.
- [ ] Author profile complete.
- [ ] Sources support major claims.
- [ ] FAQs exactly match visible answers.
- [ ] Old slug redirects after a rename.
- [ ] Clean URL appears in runtime sitemap.

## Forms and reader data

The following are stored in SQLite, not by an external static-host form service:

- newsletter subscriptions;
- contact messages;
- contributor submissions;
- reactions;
- comments;
- deduplicated article views.

Management routes require `CMS_ADMIN_TOKEN` when configured. Apply data-retention, deletion and privacy policy consistently. Do not export reader data to Git or ordinary spreadsheets without an approved operational need.

## Failure behavior

- If article rendering cannot reach SQLite, Express returns an error rather than an old article copy.
- If homepage API calls fail, the browser displays a service-unavailable state.
- If engagement writes fail, the UI rolls back optimistic state and asks the reader to retry.
- A failed comment is not queued in localStorage.
- If SMTP is unavailable, editorial notification records can be appended to durable `notifications.log`; article/form records remain in SQLite.

This behavior prevents stale or device-only data from being mistaken for a successful shared write.

## Operational health

Daily checks:

```bash
curl -fsS https://YOUR_DOMAIN/health
systemctl is-active sholynk caddy
systemctl list-timers sholynk-backup.timer
df -h /data
```

Weekly/monthly checks:

- inspect application/Caddy errors;
- verify latest consistent SQLite/upload backup;
- verify encrypted off-instance replication;
- test a representative article, reaction, comment and form;
- inspect disk growth and SQLite integrity;
- review pending submissions and data-retention actions;
- verify certificate and DNS health.

Quarterly:

- perform a restore test into an isolated location;
- rotate credentials as policy requires;
- review dependency audit and Node security updates;
- verify OCI budget/monitoring contacts;
- review Oracle's current Always Free and idle-reclamation terms.

## Handover records the owner must keep

- production domain/DNS registrar;
- OCI tenancy, region, compartment, instance and block-volume OCIDs;
- current public IP/reserved IP;
- deployed Git commit/tag;
- admin-token recovery/rotation procedure;
- SMTP and backup secret locations;
- backup retention and last restore-test date;
- incident contacts;
- editorial approval and privacy-retention owners.
