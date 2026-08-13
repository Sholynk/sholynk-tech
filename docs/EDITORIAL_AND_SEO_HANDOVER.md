# Editorial, SEO and build handover

This document describes the compatibility-first publishing layer added to Sholynk Tech. The public presentation remains vanilla HTML/CSS/JavaScript, the runtime CMS remains Express + SQLite, and long-form Markdown remains the version-controlled source of truth.

## Safe publishing workflow

1. Edit or add a Markdown file in `article_stories/`.
2. Use only information supported by the article and sources you have actually checked. Never add placeholder citations.
3. Run `npm run sync`.
4. Run `npm test`.
5. Review the generated page at `/articles/<slug>/` and also check the legacy `/article.html?slug=<slug>` route.
6. Commit the Markdown, generated JSON, generated HTML, generated images, sitemap and robots file together.

`npm run sync` performs these stages:

- imports Markdown stories and card-only seed records into the local SQLite mirror;
- exports `content-fallback.json` and `articles.json` for static hosting;
- validates required metadata, body length, image paths, JSON fields and URLs;
- generates initial-HTML article pages under `articles/`;
- generates non-destructive WebP hero variants under `generated-images/`;
- generates `sitemap.xml` and `robots.txt`.

Original images are never overwritten. Generated directories can be reproduced by running the command again.

## Ownership and compatibility boundaries

- `article_stories/*.md` owns long-form article copy and front matter.
- `cms/data/seed.json` owns empty-body teaser cards and standalone hero entries.
- `content-fallback.json`, `articles.json`, `articles/`, `generated-images/`, `sitemap.xml` and `robots.txt` are generated; do not hand-edit them.
- `/article.html?slug=...` remains supported for existing links and engagement data.
- `/articles/<slug>/` is the canonical, crawlable URL for a body-bearing article.
- Reactions and comments continue to use the article slug, so both URL forms share engagement data.
- Empty-body and external-link records are not converted into articles and do not receive Article schema.

## Structured front matter

The parser accepts single-line values. Arrays and objects must be valid JSON on one line.

| Field | Purpose |
| --- | --- |
| `title`, `slug`, `category`, `description` | Required identity and card metadata |
| `img`, `alt` | Required hero image and accessible alternative text |
| `date`, `author` | Required publication and byline data |
| `authorSlug` | Optional link to the author entity (defaults to `oluwashola-busari`) |
| `contentType` | `article`, `news`, `guide`, `analysis`, `opinion` or `review` |
| `subcategory`, `tags` | More precise classification and search terms |
| `hook` | Standfirst shown below the generated page heading |
| `directAnswer` | Concise answer block; omit if the article does not support one |
| `keyTakeaways` | JSON array of concise, supported points |
| `faqs` | JSON array of `{ "question": "...", "answer": "..." }` records |
| `relatedSlugs` | JSON array of existing article slugs |
| `sources` | JSON array of verified source records |
| `seoTitle`, `seoDescription` | Optional search/social overrides |
| `canonicalUrl` | Optional absolute HTTPS override; normally generated automatically |
| `status` | `published`, `draft` or `scheduled` |
| `scheduledAt` | Required when status is `scheduled` |
| `reviewNotes` | Internal workflow notes stored by the CMS; not rendered publicly |

### Source record

```json
{
  "title": "Exact source title",
  "publisher": "Publishing organisation",
  "author": "Named author, if available",
  "publishedAt": "2026-08-01",
  "url": "https://publisher.example/report",
  "type": "official",
  "doi": "",
  "accessedAt": "2026-08-13",
  "supports": "The exact statement or section this source supports"
}
```

Allowed source types are `primary`, `official`, `research`, `journalism`, `reference` and `other`. A source title and absolute HTTP(S) URL are required. The build emits citation URLs into Article schema and a visible Sources section only when records exist.

## Generated SEO output

Each full article page contains:

- unique title, description and canonical tags in initial HTML;
- Open Graph and Twitter card metadata;
- `Article` and `BreadcrumbList` JSON-LD;
- `FAQPage` JSON-LD only when real FAQs are supplied;
- an author link to the existing About profile and its `Person` entity;
- responsive `srcset` hero images while retaining the original fallback;
- the complete sanitized article body without requiring JavaScript;
- progressive enhancement for reading progress, reactions and comments.

The default production origin is `https://sholynktech.netlify.app`. Set an HTTPS `SITE_URL` during generation if the production origin changes:

```bash
SITE_URL=https://www.example.com npm run sync
```

Update the fixed homepage/About canonical and entity URLs at the same time if the production domain changes.

## CMS controls

The admin dashboard supports the additive article fields, JSON source/FAQ editing, workflow states and author entities. The API exposes nested source endpoints and author CRUD. Remember that Markdown-owned stories will overwrite database edits on the next sync, so make durable edits in front matter.

Write operations can be protected with `CMS_ADMIN_TOKEN`. The admin UI is marked `noindex`, and `robots.txt` disallows `/admin/` and `/api/`.

## Validation and quality gates

Use:

```bash
npm run validate
npm run build
npm test
npm audit
```

Validation fails for missing required metadata, duplicate/invalid slugs, short published bodies, missing local images, invalid structured arrays, malformed FAQ/source records, unsupported types and insecure canonical overrides. SEO length and absent-source checks are advisory warnings so existing truthful content is not blocked or padded with fabricated material.

Before release, inspect `git diff --check`, verify generated pages with JavaScript disabled, confirm sitemap URLs on the deployed origin, and run a structured-data validator against at least one article and the About page.

## Rollback

The enhancement is additive. If generated output must be disabled during an incident, deploy the previously known-good commit: legacy static pages, JSON fallback, CMS endpoints and query-string article links remain architecturally intact. Do not delete originals or rewrite slugs as part of rollback.
