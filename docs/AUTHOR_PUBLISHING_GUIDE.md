# Author and publishing guide

This guide covers the production editorial workflow for the dynamic Sholynk CMS. Published content is stored in SQLite and appears on the site immediately after a successful dashboard/API save. There is no export or page-generation step.

## 1. Roles and source of truth

- **Production source of truth:** the SQLite database configured by `CMS_DB_FILE`.
- **Production media:** the directory configured by `CMS_UPLOAD_DIR`.
- **Admin dashboard:** `/admin/` on the deployed site.
- **Starter/import source:** `article_stories/*.md` and `cms/data/seed.json`, used only to initialize an empty database.
- **Application source:** GitHub, deployed independently from editorial database changes.

Do not edit database files by hand. Do not run `node cms/seed.js --force` against a live database unless an intentional, backed-up re-import has been approved.

## 2. Sign in to the dashboard

1. Open `https://YOUR_DOMAIN/admin/`.
2. Enter the production admin token supplied through the approved secret-sharing channel.
3. The token is sent as `x-admin-token` to protected API routes.
4. Never paste it into an article, screenshot, Git file, issue, analytics tool or query-string URL.
5. When finished on a shared device, clear the saved token/browser storage and close the session.

If access fails:

- confirm the production domain and HTTPS;
- check that `CMS_ADMIN_TOKEN` is present in `/etc/sholynk/sholynk.env`;
- check `systemctl status sholynk` and the browser network response;
- do not disable authentication as a workaround.

## 3. Author profiles

Create the author before assigning articles to them.

Recommended fields:

- **Name:** public byline.
- **Slug:** stable lowercase identifier, for example `ada-lovelace`.
- **Role:** structured metadata/administrative description.
- **Bio:** concise expertise and disclosure information.
- **Profile URL:** an HTTPS profile or the local About page.
- **Image and image alt:** accessible headshot/reference.

Every article must resolve to a registered author entity. Unknown or deleted author references fall back to the site owner so articles do not become orphaned. Deleting a contributor reassigns their articles according to CMS policy; review the affected list before confirming.

## 4. Create an article

From the dashboard, create a new article and complete the following.

### Required editorial fields

- **Title** — clear, specific and unique enough for readers/search.
- **Category** — one of the site's editorial categories.
- **Description** — concise card/search summary.
- **Body** — substantive Markdown or supported HTML for an internal article.
- **Author entity** — registered author.
- **Publication date** — valid date.
- **Status** — draft, pending, scheduled or published.

If the article has an image, meaningful alt text is required.

### Slug

The slug becomes the clean URL:

```text
https://YOUR_DOMAIN/articles/the-article-slug/
```

The CMS creates a URL-safe slug and makes it unique. If a published slug is renamed, the old slug is stored in SQLite as a permanent redirect. Avoid unnecessary changes because external links and analytics use the URL.

### Body format

Markdown is recommended:

```markdown
## Descriptive section heading

A focused paragraph with a [useful source](https://example.org/source).

- clear point one
- clear point two

![Meaningful image description](article-images/example/image.jpg)
```

The server converts and sanitizes article body content on each response. Scripts, event handlers and unsafe protocols are removed. Do not rely on embedded scripts, iframes or forms inside article bodies.

Use meaningful `##` headings. Three or more H2 sections generate the on-page table of contents.

### Content type and taxonomy

Use:

- `article` for general features;
- `news` for timely reporting;
- `guide` for procedural material;
- `opinion` for clearly labelled commentary;
- `review` for evaluated products/services;
- `analysis` for evidence-led interpretation.

Add focused tags rather than broad keyword lists. Categories power homepage filtering; tags and title/description support search.

### Hook, direct answer and key takeaways

- **Hook:** stronger standfirst shown beneath the title.
- **Direct answer:** concise answer box for the central question.
- **Key takeaways:** short, standalone claims supported by the body and sources.

Do not put claims in summary components that the body cannot substantiate.

## 5. Images

### Existing source image

Curated source images committed with application source use paths such as:

```text
article-images/story-slug/hero.jpg
Images and Assets/page_logo.png
```

These paths must exist in the deployed Git commit.

### CMS upload

For new production media, upload through the dashboard. The file is stored under the durable `CMS_UPLOAD_DIR` (recommended `/data/uploads`) and its metadata is stored in SQLite.

Rules:

- allowed formats are JPEG, PNG, WebP, GIF and AVIF;
- uploads are size-limited;
- the server verifies actual image format rather than trusting the filename/MIME claim;
- use a descriptive filename and alt text;
- compress appropriately before upload;
- do not put production uploads into the Git checkout by hand.

Database and upload backups must be restored as a matching set.

## 6. Sources and evidence

Add a structured source for each consequential factual claim.

Source fields can include:

- title;
- publisher;
- author;
- publication date;
- URL;
- source type;
- DOI;
- access date;
- which claim the source supports.

Prefer primary documents, official data and original research. Use HTTPS URLs when available. Confirm that links resolve and that the source actually supports the adjacent claim.

The published page displays sources and includes source URLs in article structured data.

## 7. FAQs and related articles

### FAQs

Each FAQ needs a genuine question and direct answer. FAQ entries are published in both visible content and `FAQPage` structured data, so they must match exactly and must not be promotional or misleading.

### Related articles

Specify related slugs when editorially important. The server resolves those against current published database rows and fills remaining slots with current internal articles in the same category. Draft/unpublished records do not appear publicly.

## 8. SEO metadata

### SEO title

If set, this controls the document title and social title. Keep it accurate and avoid truncation-heavy wording.

### SEO description

If set, this controls the meta/Open Graph/Twitter description. Otherwise the article description is used.

### Canonical URL

Normally leave canonical empty; the server creates:

```text
SITE_URL/articles/<slug>/
```

Only set an override when an approved HTTPS canonical exists elsewhere. Insecure/non-HTTP canonicals are rejected.

### Automatic metadata

At request time, Express creates:

- canonical link;
- Open Graph and Twitter tags;
- Article, Person, Organization and Breadcrumb schema;
- FAQ schema when FAQs exist;
- published/modified dates;
- current author details;
- sitemap entry for eligible published internal articles.

No rebuild is required after metadata changes.

## 9. Status workflow

### Draft

Use while writing/editing. Drafts require admin authentication and do not appear on public lists, clean article routes or the sitemap.

### Pending

Used for contributor submissions and editorial review. Add review notes without publishing sensitive internal discussion.

### Scheduled

Provide a valid scheduled date/time. Confirm the application's scheduling policy/worker before relying on automatic transition; a scheduled status is not publicly visible until it becomes published.

### Published

Before choosing published, verify:

- title, description, body and author;
- factual claims and source links;
- hero/body image rights and alt text;
- headings and reading flow;
- canonical/SEO fields;
- category/tags/content type;
- FAQs and related slugs;
- mobile/desktop preview;
- no confidential review notes or contributor details are exposed.

After saving, load the clean URL in a private browser window and verify the live result.

## 10. External-link entries

An entry can link to an approved external HTTP(S) URL or safe application-local path rather than render an internal body. The homepage/API will use that destination, and the internal clean route redirects.

Use external entries sparingly. They are excluded from the internal article sitemap because the destination is not hosted as a Sholynk article.

## 11. Contributor/PDF submissions

Contributor submissions use `/api/submissions` and can include a PDF for metadata assistance. With `CMS_REQUIRE_APPROVAL=true`, submitted work remains pending until an administrator reviews and publishes it.

The server:

- streams temporary PDFs to the operating-system temp directory;
- extracts suggested values;
- deletes the temporary upload after processing;
- stores approved article data in SQLite;
- records notification data/send status.

See [PDF import and autofill](pdf-import-autofill.md) for supported fields and security constraints.

## 12. Editing and deleting

### Editing

A successful save changes the current SQLite row. The next article/API request sees the update without a deploy.

Slug rename behavior:

- engagement and views move to the new slug;
- a permanent redirect row keeps the old clean URL working;
- sitemap/canonical use the new slug on subsequent requests.

### Deleting

Deleting an article also removes reader history attached to it according to the database implementation. Before deletion:

1. confirm it is not merely supposed to be draft/unpublished;
2. preserve any required legal/editorial record;
3. create/verify a recent backup;
4. check inbound links and related-article references;
5. confirm the deletion in the dashboard.

## 13. Starter Markdown workflow (new installations only)

`article_stories/*.md` remains useful for a fresh installation or a deliberately reviewed migration. It is not the normal production publishing workflow.

For a brand-new empty database:

```bash
npm run validate
npm run seed
```

`npm run seed` refuses to import when articles already exist. An explicit `node cms/seed.js --force` updates matching records and can overwrite dashboard fields. Use `--force` only after backup, review and approval.

Changes to starter Markdown in Git do not update the live site by themselves. This separation protects production dashboard edits during code deployment.

## 14. Post-publication verification

For every important publication:

1. open `/articles/<slug>/` without dashboard authentication;
2. confirm HTTP 200 and correct title/body;
3. inspect source to ensure title, canonical and JSON-LD are present in initial HTML;
4. verify author/profile and dates;
5. check all images/alt text;
6. submit a reaction/comment test only when appropriate, then moderate/remove it;
7. search/filter on the homepage;
8. check that `/sitemap.xml` includes the internal published URL;
9. check social preview tools after caches expire;
10. confirm `/health` remains healthy.

## 15. Troubleshooting

### Article does not appear

- status is not published;
- body is empty and no external link is set;
- category/search filter hides it;
- the browser/API request is failing;
- a deployment is connected to a different `CMS_DB_FILE`;
- Caddy or DNS is pointing to another VM.

### Edit disappears after restart

This indicates a persistence/configuration problem, not expected behavior:

- verify `CMS_DB_FILE=/data/cms.sqlite`;
- run `findmnt /data`;
- confirm the service user owns/can write `/data`;
- confirm no startup/deploy command force-runs the seed importer;
- inspect `journalctl -u sholynk`.

### Upload disappears

- verify `CMS_UPLOAD_DIR=/data/uploads`;
- confirm `/data` was mounted before the service started;
- verify `RequiresMountsFor=/data` in systemd;
- check upload backup/restore pairing.

### Engagement unavailable

The UI intentionally does not save comments or reactions only in the browser. Check:

- `/health`;
- `/api/articles/<slug>/engagement`;
- browser network response;
- application logs;
- SQLite integrity and disk capacity.

Restore service and ask the reader to retry.

## 16. Editorial release checklist

- [ ] Correct author entity selected.
- [ ] Title, slug, description and hook are accurate.
- [ ] Body is complete with logical H2 structure.
- [ ] Claims are supported by structured sources.
- [ ] Images have rights, valid paths and descriptive alt text.
- [ ] Direct answer/takeaways/FAQs match the body.
- [ ] Related slugs resolve to appropriate published content.
- [ ] SEO title/description/canonical are reviewed.
- [ ] Status and publication date are intentional.
- [ ] Clean URL works while logged out.
- [ ] Homepage search/category behavior includes the article.
- [ ] Sitemap and server-rendered metadata are current.
- [ ] A recent production backup exists.
