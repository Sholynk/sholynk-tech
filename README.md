# sholynk-tech

An aesthetic website for NEWS articles, now backed by a lightweight Node.js CMS.

## Quick start

Requires Node.js 22.5 or newer because the local CMS uses Node's built-in SQLite
module.

```bash
npm install
npm start        # http://localhost:3000
```

On first start, the server now seeds the local CMS database automatically if it
finds no articles. You can also run `npm run seed` any time to reload/update the
starter content manually.

| URL                                                                     | What it is             |
| ----------------------------------------------------------------------- | ---------------------- |
| `http://localhost:3000/`                                                | Public homepage        |
| `http://localhost:3000/article.html?slug=the-rise-of-quantum-computing` | Long-form article page |
| `http://localhost:3000/admin/`                                          | Admin dashboard        |
| `http://localhost:3000/api/articles`                                    | Articles API           |

### Windows / VS Code PowerShell note

If VS Code opens a PowerShell terminal and `npm install` or `npm start` fails
with `npm.ps1 cannot be loaded because running scripts is disabled on this
system`, the project is not the problem: PowerShell is blocking Node's `npm.ps1`
shim. Any of these fixes works:

```powershell
# Run npm through the CMD shim from PowerShell
npm.cmd install
npm.cmd start

# Or allow scripts for this PowerShell window only
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
npm start

# Or make it permanent for your Windows user
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

You can also switch VS Code's integrated terminal profile to **Command Prompt**,
which is why the same commands worked for you in cmd.exe.

If the site starts but the homepage/category pages show no articles, your local
CMS database is empty. Run `npm run seed` once, then restart with `npm start`.
With the current code, `npm start` also auto-seeds an empty database unless you
set `CMS_AUTO_SEED=false`.

## Architecture

The site was a set of static HTML pages with content hardcoded inside `index.js`.
It now loads content from the CMS at runtime:

```
Browser ──> cms-client.js ──> /api/*  (Express + SQLite)
                   └────────> content-fallback.json  (used when the API is unreachable)
```

`cms-client.js` probes `/api/settings` once per page load. If the API answers with
JSON, the page uses live data; otherwise it silently falls back to
`content-fallback.json`, so the site still renders correctly when hosted as plain
static files (Netlify, GitHub Pages, opening the folder directly).

### Why SQLite

The repository had no build tooling, no package manager and no server. MongoDB or
Postgres would have added an external service to run before the site renders.
Node 22's built-in `node:sqlite` gives a real relational database with zero
dependencies and no native compilation. The schema in `cms/lib/db.js` is ordinary
SQL, so swapping in Postgres later only means rewriting the query implementations
in `cms/lib/articles.js` and `cms/lib/images.js`.

### Layout

```
cms/
  server.js            Express app: API, /admin, static site, /uploads
  seed.js              Imports the previously hardcoded content
  export-fallback.js   Writes content-fallback.json for static hosting
  lib/                 db, articles, images, settings
  routes/api.js        REST endpoints + multer upload handling
  admin/               Admin dashboard (vanilla HTML/CSS/JS)
  tests/               node:test integration suite
article.html/.js       Dynamic article page
article_stories/       Markdown long-form stories — THE source of truth for articles
cms-client.js          Shared front-end data layer
engagement.js          Like/dislike + comments widgets (API, offline queue)
styles.css             The entire stylesheet — no Tailwind, no build step
content-fallback.json  Generated snapshot — do not edit by hand
articles.json          Generated search index — do not edit by hand
```

## Styling

The site is plain CSS. Tailwind used to be pulled from `cdn.tailwindcss.com`
on every page; it has been removed and every utility class migrated to
hand-written rules in `styles.css`, which is organised into numbered sections
(tokens, base, header, sidebar, hero, cards, article, engagement, footer,
breakpoints) with a table of contents at the top.

There is no build step: edit `styles.css` and reload.

Breakpoints mirror the Tailwind scale that was previously in use, so responsive
behaviour is unchanged — `640px` (`sm:`) and `768px` (`md:`), plus the site's own
`700px`, `900px`/`901px` and `1100px` rules.

The navbar and footer use flat colours (`--header-bg`, `--footer-bg`,
`--footer-legal-bg`). Gradients elsewhere — hero scrim, category pills, buttons,
cards, reading-progress bar — are unchanged.

## Reader engagement

Article pages carry like/dislike buttons and a comment section, rendered by
`engagement.js`.

Reactions and comments are keyed by article **slug** rather than a foreign key.
A voter is an anonymous per-browser id in `localStorage`; it is not
authentication, it exists so the one-vote-per-reader rule can be enforced
server-side. Clicking the same button twice un-votes, and clicking the opposite
one switches sides, so repeat clicking cannot inflate a count.

### Comments are shared across devices

The comment history lives in the CMS database, so a comment posted on one
device appears on every other device that loads the same article. When the API
is unreachable (static hosting, offline, server down), comments are kept in a
per-device `localStorage` queue, shown immediately, and pushed to the shared
history automatically on the next page load or when the browser reconnects.
Every submission carries a per-comment `clientId`, so retries and queue syncs
never create duplicates.

The full comment history across all articles can be viewed and moderated from
the **Comments** tab in the admin dashboard (`/admin/`).

## API

All write operations accept JSON.

| Method          | Endpoint                         | Purpose                                                           |
| --------------- | -------------------------------- | ----------------------------------------------------------------- |
| `GET`           | `/api/articles`                  | List. Query: `category`, `q`, `status`, `hero`, `limit`, `offset` |
| `GET`           | `/api/articles/:idOrSlug`        | Single article by numeric id or slug                              |
| `GET`           | `/api/articles/categories`       | Distinct categories                                               |
| `POST`          | `/api/articles`                  | Create (requires `title`, `category`)                             |
| `PUT` / `PATCH` | `/api/articles/:id`              | Update                                                            |
| `DELETE`        | `/api/articles/:id`              | Delete                                                            |
| `GET`           | `/api/articles/:slug/engagement` | Reactions + comments in one call. Query: `voterId`                |
| `GET`           | `/api/articles/:slug/reactions`  | Like/dislike tallies. Query: `voterId`                            |
| `POST`          | `/api/articles/:slug/reactions`  | Cast a reaction (`type`, `voterId`)                               |
| `GET`           | `/api/articles/:slug/comments`   | List comments, newest first                                       |
| `POST`          | `/api/articles/:slug/comments`   | Add a comment (`author`, `body`, `clientId`) — idempotent per clientId |
| `GET`           | `/api/comments`                  | Full comment history across articles (admin)                      |
| `DELETE`        | `/api/comments/:id`              | Moderation — removes a comment (admin)                            |
| `GET`           | `/api/images`                    | List uploaded images                                              |
| `POST`          | `/api/images`                    | Upload (multipart, field `image`, plus `alt`)                     |
| `PATCH`         | `/api/images/:id`                | Update alt text                                                   |
| `DELETE`        | `/api/images/:id`                | Delete record and file                                            |
| `GET` / `PUT`   | `/api/settings`                  | Site metadata                                                     |

Uploads are limited to 8 MB and to JPEG, PNG, WebP, GIF and AVIF.

### Securing the admin

Write endpoints are open by default for local development. Set `CMS_ADMIN_TOKEN`
to require a token, then paste the same value into the "Admin token" field in the
dashboard:

```bash
CMS_ADMIN_TOKEN=your-secret npm start
```

### Environment variables

| Variable          | Default               | Purpose                              |
| ----------------- | --------------------- | ------------------------------------ |
| `PORT`            | `3000`                | HTTP port                            |
| `CMS_ADMIN_TOKEN` | unset                 | Require a token for write operations |
| `CMS_DB_FILE`     | `cms/data/cms.sqlite` | Database location                    |
| `CMS_UPLOAD_DIR`  | `uploads/`            | Where uploaded images are stored     |

## Content workflow

### Long-form articles live in Markdown

Every file in `article_stories/*.md` is an article. The file starts with a
small front-matter block that holds the metadata; everything after it is the
article body:

```markdown
---
title: The Rise of Quantum Computing: The Computing Revolution Beyond Silicon
slug: the-rise-of-quantum-computing   # optional — derived from the title if absent
category: Technology
description: A one- or two-sentence summary shown on cards and in search.
img: article-images/quantum/quantum-computer-chandelier.jpg
alt: Golden chandelier-like cryostat of a superconducting quantum computer
date: 2026-08-02
readingTime: 12 min read            # optional — estimated from word count
featured: true                      # optional
hero: true                          # optional — show on the homepage hero
heroOrder: 1                        # optional, with hero: true
seoTitle: ...                       # optional
seoDescription: ...                 # optional
author: Busari Oluwashola           # optional
---

## Introduction

The article body starts here. `##` headings become the table of contents.
```

To add an article: drop a new `.md` file in `article_stories/` (optionally
adding a hero flag or a card image), then run:

```bash
npm run sync
```

> New to the workflow? Read **`article_stories/README.md`** — a step-by-step,
> beginner-friendly guide (with a template, a worked example, and a
> troubleshooting checklist) for adding articles.

`npm run sync` seeds the database from the Markdown files (plus the card-only
entries in `cms/data/seed.json`) and regenerates both static snapshots
(`content-fallback.json` and `articles.json`), so the site works identically
whether it is served by the Node server or hosted statically. Editing an
article is the same: change the `.md` and run `npm run sync` again.

### Admin dashboard

The dashboard at `/admin/` manages images, site metadata, and the comment
history. Long-form articles are owned by their Markdown files, so article edits
made in the dashboard are overwritten by the next `npm run sync` — edit the
`.md` files instead.

Article HTML is sanitised on render: `<script>`, `<iframe>`, inline event
handlers and `javascript:` URLs are stripped, and images without `alt` get an
empty one.

## Tests

```bash
npm test
```

| Suite                   | Covers                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.test.js`           | Article CRUD, validation, slug uniqueness, search and category filters, image upload/serve/delete, upload type rejection, settings                                                                                        |
| `engagement.test.js`    | Reaction tallies, one-vote-per-reader, toggle and switch behaviour, comment CRUD, empty-submission rejection, per-article scoping                                                                                         |
| `engagement-ui.test.js` | The widgets in jsdom against the localStorage fallback: optimistic updates, spam-click protection, persistence across reload, comment escaping                                                                            |
| `frontend.test.js`      | That no page loads Tailwind or uses its utility classes, that the hero H1 computes to white, that the navbar/footer are solid while other gradients survive, and that `article.html` matches the CMS article structure |

Each run uses a throwaway database in a temp directory.

## Notes

The database and `uploads/` are gitignored runtime state. Recreate them with
`npm run seed`.
