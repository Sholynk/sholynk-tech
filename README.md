# sholynk-tech

An aesthetic website for NEWS articles, now backed by a lightweight Node.js CMS.

## Quick start

```bash
npm install
npm run seed     # load the starter content into the database
npm start        # http://localhost:3000
```

| URL                                                                     | What it is             |
| ----------------------------------------------------------------------- | ---------------------- |
| `http://localhost:3000/`                                                | Public homepage        |
| `http://localhost:3000/article.html?slug=the-rise-of-quantum-computing` | Long-form article page |
| `http://localhost:3000/admin/`                                          | Admin dashboard        |
| `http://localhost:3000/api/articles`                                    | Articles API           |

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
article_01.html        Hand-authored article ("Mastering the Art of Coding")
article-static.js      Reading progress + engagement for hand-authored pages
cms-client.js          Shared front-end data layer
engagement.js          Like/dislike + comments widgets (API, localStorage fallback)
styles.css             The entire stylesheet — no Tailwind, no build step
content-fallback.json  Generated snapshot — do not edit by hand
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

Both article pages carry like/dislike buttons and a comment section, rendered by
`engagement.js`.

Reactions and comments are keyed by article **slug** rather than a foreign key,
so the hand-authored `article_01.html` uses the same endpoints as CMS articles.
A voter is an anonymous per-browser id in `localStorage`; it is not
authentication, it exists so the one-vote-per-reader rule can be enforced
server-side. Clicking the same button twice un-votes, and clicking the opposite
one switches sides, so repeat clicking cannot inflate a count.

Like the rest of the front-end, the widgets prefer the API and fall back to
`localStorage` when it is unreachable, so they keep working on static hosting.

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
| `POST`          | `/api/articles/:slug/comments`   | Add a comment (`author`, `body`)                                  |
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

1. Open `/admin/`.
2. Create or edit an article. Body accepts HTML — the toolbar inserts headings,
   figures, quotes and lists. `<h2>` elements automatically become the article's
   table of contents.
3. Upload images under **Media library**, set alt text (required), then use
   **Use as hero** or **Copy URL** to place them in the body.
4. Articles with a body render at `/article.html?slug=...`. Leaving
   "External link override" set instead points the homepage card elsewhere.
5. If you deploy statically, run `node cms/export-fallback.js` to refresh
   `content-fallback.json`.

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
| `frontend.test.js`      | That no page loads Tailwind or uses its utility classes, that the hero H1 computes to white, that the navbar/footer are solid while other gradients survive, and that `article_01.html` matches the CMS article structure |

Each run uses a throwaway database in a temp directory.

## Notes

The database and `uploads/` are gitignored runtime state. Recreate them with
`npm run seed`. The legacy `article_01.html` page is still served, and the
"Mastering the art of coding" card continues to point at it.
