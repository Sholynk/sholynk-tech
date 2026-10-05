# Starter article stories

This directory contains version-controlled Markdown used to initialize a **brand-new, empty** Sholynk SQLite database. It is not a public runtime content directory and it is not read when serving homepage or article requests.

## Production rule

After initial import:

- SQLite is authoritative;
- edit/publish through `/admin/`;
- code deployment does not import this directory;
- changing a Markdown file does not change the deployed article;
- never run a forced import without a backup and explicit editorial approval.

Express does not expose `/article_stories` publicly.

## Initialize an empty database

Configure `CMS_DB_FILE` and `CMS_UPLOAD_DIR`, then run:

```bash
npm run validate
npm run seed
```

`npm run seed` imports only when no article rows exist. If rows already exist, it exits without changing them.

An intentional re-import can be run with:

```bash
node cms/seed.js --force
```

This updates matching slugs and can overwrite fields edited in the dashboard. Treat it as a migration tool, not a publishing command.

## File format

Each article is a UTF-8 `.md` file with front matter at the top:

```markdown
---
title: "A clear article title"
slug: "clear-article-title"
category: "Technology"
contentType: "analysis"
description: "A concise summary for cards and metadata."
hook: "A strong standfirst beneath the title."
directAnswer: "A short direct answer when relevant."
author: "Oluwashola Busari"
authorSlug: "oluwashola-busari"
date: "2026-01-15"
readingTime: "8 min read"
status: "published"
featured: false
hero: false
img: "article-images/clear-article-title/hero.jpg"
alt: "Descriptive text explaining the hero image."
tags:
  - "example"
  - "technology"
keyTakeaways:
  - "A concise, supportable takeaway."
relatedSlugs:
  - "another-article"
faqs:
  - question: "What is the central idea?"
    answer: "A direct answer that also appears visibly on the page."
sources:
  - title: "Primary source title"
    publisher: "Publisher"
    author: "Source author"
    publishedAt: "2026-01-10"
    url: "https://example.org/source"
    type: "primary"
    supports: "The specific claim this source supports."
---

## First section

Write the article in Markdown.
```

The exact parser supports the metadata structures already used by files in this directory. Run `npm run validate` after editing.

## Required quality rules

- The file needs a front-matter block. A Markdown file without front matter is ignored by the importer.
- Title and category must be present.
- Slugs should be stable, lowercase and URL-safe.
- An image requires meaningful alt text.
- Local image paths must stay inside the repository and point to real files.
- Canonical overrides must be absolute HTTPS URLs.
- Sources must use safe HTTP(S) URLs.
- Related slugs should refer to intended articles.
- Status must be one supported by the CMS.
- Use clear H2 sections; three or more produce a table of contents.
- Do not embed scripts, iframes, forms or unsafe HTML. The runtime renderer sanitizes content.

## Images

Starter article images belong under:

```text
article-images/<story-slug>/
```

Commit source images and any `SOURCES.md` attribution file. These are starter/application assets. Images uploaded later through the production dashboard live under the durable cloud `CMS_UPLOAD_DIR` and must not be copied into this folder as part of routine publishing.

## What validation checks

`npm run validate` checks starter content before it is merged/deployed, including:

- parseable front matter;
- required fields;
- duplicate/malformed slugs;
- valid status/content/source types;
- image alt text and local file existence;
- URL safety;
- structured fields such as sources and FAQs.

`npm run build` runs this validation but creates no public content files.

## What the importer does

For an empty database, `cms/seed.js`:

1. ensures the default owner author exists;
2. reads front matter and Markdown body;
3. creates article rows and structured source rows in SQLite;
4. imports starter card/hero entries from `cms/data/seed.json`;
5. sets initial settings;
6. leaves serving to the normal dynamic Express routes.

It does not create article HTML, JSON exports, discovery files or image derivatives.

## Troubleshooting

### The importer says the database already contains articles

That is a safety feature. Use the dashboard for production edits. If this is a disposable/local database, point `CMS_DB_FILE` at a new empty path. Use `--force` only for an approved migration after backup.

### The story is skipped

Confirm the file:

- ends in `.md`;
- is not this README;
- starts with `---` front matter;
- has a closing `---`;
- passes `npm run validate`.

### The image fails validation

- use a repository-relative path;
- match capitalization and spaces exactly;
- commit the referenced file;
- provide non-empty alt text.

### Imported content does not appear publicly

- confirm status is `published`;
- confirm body is non-empty or an external link is valid;
- confirm the running service points at the database that was seeded;
- check `/health` and `/api/articles/<slug>`;
- load `/articles/<slug>/` through Express, not by opening repository files directly.

## Checklist for adding starter content

- [ ] Front matter is complete and valid.
- [ ] Author entity/slug is intentional.
- [ ] Body has a useful structure and evidence.
- [ ] Image files and attribution are committed.
- [ ] Alt text is descriptive.
- [ ] Sources support all consequential claims.
- [ ] `npm run validate` passes.
- [ ] `npm test` passes.
- [ ] The change is described as starter content, not a direct production publication.
