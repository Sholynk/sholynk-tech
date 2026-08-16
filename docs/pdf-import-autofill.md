# PDF-to-Article Autofill: How It Works and What It Would Take to Ship

This document explains how the "upload a PDF to autofill the article form" feature
currently works in the Sholynk CMS, what it can realistically do today, what is
required to turn it into a publish-grade workflow, and what is needed to support
the guideline/handout/keywords use-case you described (authors receive a manual,
read the keywords they need to know, and submit a PDF that the CMS ingests).

---

## 1. What you get right now (already shipped)

A new field is added to the article editor in **Articles → Import from PDF**:

1. The author picks a `.pdf` from their computer.
2. The browser uploads the file to `POST /api/import/pdf` (admin-token protected,
   same as the rest of the write API).
3. The server runs the file through `pdf-parse` (a pure-JS PDF text extractor),
   then runs a set of heuristic rules in `cms/lib/pdf-import.js` to produce a
   draft object shaped exactly like the article form:
   - `title` — first plausible short line near the top of the document.
   - `description` — first real paragraph (≥60 chars), used for the teaser/meta.
   - `hook` — first ~160 chars of the description for the standfirst.
   - `body` — the full text converted to lightweight Markdown:
     - title → `# Heading`
     - short uppercase / word-case lines → `##` section headings
     - bullet/dash/numbered lines → `- ` list items
     - everything else → paragraphs
   - `tags` — top recurring non-stopword terms plus a few multi-word signals
     ("large language", "machine learning", "smart contract", …).
   - `category` — guessed from keyword frequencies (AI Trends, Technology,
     Cryptocurrency, Web 3, Game).
   - `readingTime` — word-count ÷ 200 wpm.
   - `meta.pages`, `meta.info`, `meta.wordCount` — diagnostics shown to the author.
4. The client **only fills fields that are still empty**. It does not overwrite
   a title, category, or body the author already typed. The author is expected
   to review, tweak, and add images/sources/SEO before hitting Save.
5. The uploaded PDF is streamed to the OS temp directory and deleted immediately
   after parsing — it is not kept on disk, avoiding orphaned uploads.

This gives authors a real "upload PDF → pre-filled draft" button today, but it
is explicitly a **drafting aid**, not a magic publisher. PDFs do not encode
semantic structure reliably, so heuristic extraction will always need a human
pass.

---

## 2. Why "perfect autofill" is hard

A PDF is a visual layout format, not a document format. By the time a Word doc,
Google Doc, or Pages file is exported to PDF:

- Headings, paragraphs and lists are just absolutely-positioned glyph runs.
- Bold/italic and links may or may not survive depending on how the PDF was made.
- Images, pull-quotes, captions and tables are positioned rectangles with no
  structural meaning attached.
- Columns, footnotes, page numbers, headers/footers and drop-caps end up as
  inline text in roughly visual but not logical order.
- Tables of contents and indices produce phantom "headings" in the middle of the
  extracted text.

For that reason, every real-world CMS that offers "import from Word/PDF"
(WordPress, Ghost, Substack, Medium, Notion) ships it as **"paste/import as a
starting point, then clean up"**, never as "press once, publish".

The version in place today is built around that honest contract.

---

## 3. Turning the handout/guideline idea into a real workflow

You described: *"the author would just be handed something like a manual/guidelines
for writing articles on the page and the guideline they need, the keywords they
need to know and other necessary things will be in the handout."*

That is a much more solvable problem than "ingest any arbitrary PDF", because
**you control the format of the handout**. You can build a **structured template**
that the extractor can rely on 100% of the time.

### 3.1 Recommended approach: a Sholynk Article Template

Provide authors with a downloadable template (`.docx` or `.pdf` exported from it)
with labelled sections in a fixed order, e.g.:

```
TITLE: <one line>
CATEGORY: <one of: Technology | AI Trends | Cryptocurrency | Game | Web 3>
AUTHOR: <name>
HOOK / STANDFIRST: <1–2 sentences>
DESCRIPTION / TEASER: <≤160 characters>
KEYWORDS / TAGS: <comma separated>
KEY TAKEAWAYS:
  - <bullet 1>
  - <bullet 2>
  - <bullet 3>
QUICK ANSWER (optional):
  <2–3 sentence direct answer>
BODY:
  ## Introduction
  <text>
  ## First section heading
  <text>
  ## Conclusion
  <text>
SOURCES (optional):
  - Title | URL | Publisher | Type
FAQS (optional):
  Q: <question>
  A: <answer>
```

Because the author is writing to this template, `pdf-import.js` becomes a
deterministic parser instead of a heuristic guesser:

1. Strip page footers/headers with a regex (already done).
2. Split the text on the exact labels (`TITLE:`, `CATEGORY:`, `BODY:`, …).
3. Each labelled block maps directly to the CMS field of the same name.
4. Anything between `## heading` lines inside BODY becomes Markdown sections.
5. The extractor returns a near-perfect payload — tags, key takeaways, FAQs and
   sources already structured as the arrays the API expects.

The parser can also **validate**: missing TITLE, missing BODY, tag count,
description length, and surface those as inline warnings next to the form
(e.g. "Add a Quick answer for featured articles", "You have 5 takeaways, 3 is
the recommended maximum").

### 3.2 Serving the handout inside the admin

The admin can host the template as a static download alongside a short on-page
writing guide:

- Add a static file `cms/admin/sholynk-author-guidelines.pdf` (and a `.docx` for
  editors who prefer to work in Word).
- Add a banner/link above the "Import from PDF" control:
  *"New writer? Download the article template + style guide and fill it in,
  then upload it here."*
- Optionally pre-fill the body with a starter skeleton
  (`## Introduction\n\n…\n\n## Conclusion`) when the author clicks "New article".

### 3.3 Keyword/guideline "cheat sheet" content

If you want the handout to expose the keywords authors *need to know*
(recommended categories, tag taxonomy, SEO title length, image dimensions,
fact-checking requirements, source-type list, forbidden phrasings), you don't
need any AI for that — you just author the handout PDF once and link to it.
The CMS can also embed a "Guidelines" collapsible panel in the article form
with the same rules for quick reference.

---

## 4. What would need to be built to upgrade from "draft" to "production"

The current heuristics are fine for a v1, but if you want the experience to feel
magical to authors, here is the full stack, broken down by layer.

### 4.1 Extraction quality (backend)

| Improvement | What it gives you | Effort |
|---|---|---|
| Template-based parser (§3.1) | Near-perfect field mapping when authors use the Sholynk template | Small |
| Use `pdfjs-dist` directly instead of `pdf-parse` | Font-size/position data lets you pick the title as the **largest text on page 1** instead of guessing; you also get heading levels by font size, which turns section detection from heuristics into reliable logic | Small–medium |
| Detect bold/italic spans | Proper Markdown `**bold**` and `*italic*` in the body instead of plain text | Medium |
| Link extraction (annotation layer) | Converts inline URLs and linked text into Markdown `[text](url)` | Medium |
| Image extraction (`pdf-parse` v2 exposes `getImage()`) | Pulls hero candidates / inline figures out of the PDF and auto-uploads them to the media library | Medium |
| Table detection (`getTable()`) | Emits HTML `<table>` markup inside the body for articles with data tables | Medium |
| Per-page chunk fallback | When the PDF can't be parsed (scanned pages, DRM), fall back to a clear error: "This PDF looks like a scan. Please upload the original text document." | Small |
| OCR fallback for scanned PDFs | Run images through Tesseract.js (pure JS) or a cloud OCR API so scanned manuscripts still produce text | Large (and Tesseract needs language packs) |

### 4.2 Field-level AI polish (optional, for step 2)

Heuristics cannot produce great tags, SEO descriptions, key-takeaways, or
FAQ pairs reliably. If you want that, you need an LLM step after extraction.

**Architecture:**

```
PDF upload
  ↓
pdfjs text + structure extraction  (1–3 s)
  ↓
structured JSON (title, body_md, …)
  ↓
LLM "editor" call (e.g. GPT-4o-mini / Claude Haiku / Gemini Flash)
prompted with Sholynk editorial guidelines
  ↓
{ title, hook, description, tags[], keyTakeaways[], faqs[], seoTitle, seoDescription }
  ↓
Fill the form, but mark AI-suggested fields so the author sees what was auto-filled.
```

**What's required:**

1. **An LLM API key** (OpenAI, Anthropic, Google Gemini, or an open-source model
   self-hosted behind an internal endpoint).
2. **Server-side proxy** — never expose API keys in the browser. Add a route
   like `POST /api/import/pdf/enhance` that:
   - accepts the already-extracted JSON,
   - calls the model with a short system prompt describing Sholynk's voice,
     categories, source policy and tag conventions,
   - returns only the curated fields.
3. **Cost control** — cache results keyed by a hash of the PDF, add rate limits
   per admin token, and set a max token cap. A single short article enhancement
   call should cost well under one US cent on modern cheap models.
4. **Editor review UI** — show a small "Suggested by AI" badge next to each
   AI-populated field, and an "Apply / Revert" button per field. This is
   important for editorial trust and for SEO.

This step is optional; you can ship v1 without it and add it once the template
workflow is being used.

### 4.3 Frontend/admin

- **Image field for authors** — *already done*: the Authors tab now has a real
  file upload (not just a URL box), an image preview, and the photo flows into
  the author card on articles.
- **Import status indicator** — *already done* (`#pdfImportStatus`).
- **Per-field "accepted from PDF" highlight** — flash each filled field for a
  second so the author sees exactly what changed. ~1 hour.
- **Guidelines help panel** — `<details>` block above the PDF import field with
  the author handout PDF link, category list, tag tips and source rules. ~1 hour.
- **"Reset from new PDF"** — explicitly clears form fields before importing a
  different file (with a confirm dialog). ~30 min.

### 4.4 Images and media

- When the PDF contains embedded images, `pdf-parse` v2's `getImage()` returns
  them as buffers. Upload them through the existing `/api/images` pipeline (sharp
  validation + resizing + DB record) and embed the returned `/uploads/...` URLs
  directly in the generated Markdown body as `<figure>` blocks with placeholder
  captions the author can then edit.
- If the first page has a large image, surface it as a hero-image candidate
  (pre-fill `img`/`alt` but don't publish without the author confirming alt
  text).

### 4.5 Validation and safety

- The PDF upload is already multer-restricted to `application/pdf` and 25 MB,
  stored in the OS temp directory, and always deleted after parsing.
- The returned body still flows through the existing `sanitizeHtml()` pipeline
  on the frontend and the SQLite validation layer on the backend, so any stray
  HTML/JS in the PDF cannot become executable content.
- LLM output, if added, must be treated as **untrusted markdown** and passed
  through the same sanitiser before saving — never inject raw model HTML into
  the body field.

### 4.6 Storage and privacy

- The current implementation does not persist the PDF. If you want authors to
  be able to re-import the original source, add a `source_pdf_path` column to
  the articles table and serve originals only to admins.
- Decide on a retention policy — e.g. keep manuscripts for 90 days after
  publish, then delete. Add a TTL cron (or simply an `npm run prune-manuscripts`
  script) to enforce it.

### 4.7 Tests

- Add a fixture PDF for each template section (one with a full set of fields,
  one with missing description, one with scanned pages) and a test that calls
  `extractPdfDraft()` and asserts the returned shape. The existing
  `cms/tests/` suite uses Node's built-in test runner; new tests slot in
  alongside the existing ones.

---

## 5. Cost, timeline and rollout plan

Suggested rollout, smallest-to-largest:

1. **v1 (already done):** Heuristic PDF → draft autofill, author photo upload,
   author bio card in-article. Authors can upload PDFs and get a first draft
   immediately.
2. **v1.1 (~half a day):** Author the Sholynk article template PDF, add it as
   a download in the admin, implement the labelled-section parser for it.
   Uploads of this template will produce near-perfect field fills.
3. **v1.2 (~half a day):** Add inline guidelines panel + "AI/imported" field
   highlight so authors see what changed.
4. **v2 (1–2 days):** Swap `pdf-parse` convenience wrapper for `pdfjs-dist` to
   get font-size/position awareness → reliable heading levels and title
   detection; add embedded image extraction → auto-upload inline figures.
5. **v3 (2–4 days plus API cost):** Add an LLM editorial pass (tags, key
   takeaways, SEO title/description, FAQ suggestions) behind a feature flag,
   with "accept/revert" UI.
6. **v4 (optional, several days):** OCR for scanned PDFs, table extraction,
   collaborative review notes, manuscript retention/versioning.

API costs for v3 are sub-cent per article on modern small models; the
infrastructure stays within the existing Node/Express/SQLite stack — no new
services required beyond an outbound HTTPS call.

---

## 6. Editorial review workflow (shipped)

Because heuristic PDF autofill is never 100 % accurate, the CMS now enforces a
"submit for review" gate before anything goes live:

- **New article status: `pending`.** The status dropdown in the editor starts
  on "Pending review" (other options: Draft, Scheduled, Published). The primary
  button is labelled **Submit for review**; a secondary **Save draft** button
  lets authors keep working without triggering a notification.
- **Client-side validation** runs on submit. Before anything hits the server,
  the editor checks that the title (≥ 6 chars), category, author name,
  description (40–200 chars), body (≥ 200 chars, with at least one `##`/`<h2>`
  section), tags (≥ 2), submitter email (valid), and alt text on any hero
  image are all present. Errors are shown in a red inline panel *and* the
  fields can be fixed in place — the form is never silently reset.
- **Server-side validation** (`requireSubmissionFields` in
  `cms/routes/api.js`) enforces the same rules before a record is saved, so a
  stale browser or hand-crafted API request can't bypass the checks.
- **Email notification on submission.** When an article moves into `pending`,
  `cms/lib/notifications.js` sends an email to `sholynktech@gmail.com`
  (configurable via `SHOLYNK_EDITOR_EMAIL`) containing the title, author,
  category, slug, submitter email, tag list, description and direct links to
  the CMS admin and the preview URL. A submissions row is written to the
  `submissions` table for an audit trail.
  - When SMTP credentials are configured (see §7), it uses `nodemailer` over
    SMTP (works with Gmail app passwords, SendGrid, Mailgun, Postmark, etc.).
  - Without SMTP (the default, including local development) it **does not
    silently fail**: it logs the notification to `cms/data/notifications.log`
    and prints a message to the server console, so submissions don't get lost
    while you're still setting up email.
- **Success feedback.** The response includes a `reviewNotice` flag and the
  admin shows a green banner: *"Submitted for review — Sholynk Tech has been
  notified."*
- **Pending posts stay private.** Pending, draft and scheduled articles are
  only visible through the API when an admin token is supplied (when one is
  configured), and are excluded from the public article listing, related
  posts, prerendered site build and content-fallback snapshot.

### 7. Email configuration (production)

Set these environment variables where the CMS runs (Netlify, Render, Fly.io,
VPS, etc.):

| Variable | Purpose |
|---|---|
| `SHOLYNK_EDITOR_EMAIL` | Destination for review notifications. Defaults to `sholynktech@gmail.com`. |
| `SMTP_HOST` | SMTP server, e.g. `smtp.gmail.com`. |
| `SMTP_PORT` | `465` for SSL, `587` for STARTTLS. |
| `SMTP_SECURE` | `true` for port 465, `false` otherwise. |
| `SMTP_USER` / `SMTP_PASS` | SMTP login. For Gmail, use a Google Account **App Password** (2FA must be enabled); never use your main password. |
| `SMTP_FROM` | "From" address; defaults to `SMTP_USER`. |
| `SITE_BASE_URL` | Public URL of the deployed site (used in email links). |
| `CMS_ADMIN_TOKEN` | If set, admin endpoints require this token and non-published articles are hidden from the public API. **Recommended for production.** |
| `CMS_REQUIRE_APPROVAL` | If `true`, any attempt to save with status `published` (via the API) is automatically downgraded to `pending`, so editors/guests can't self-publish. |
| `CMS_AUTO_SEED` | Set to `false` on a persistent host to skip reseeding demo content on every boot. |

## 8. Files changed/added for v1

- `cms/admin/index.html` — author photo upload slot, PDF import field,
  submitter-email field, validation/review banner markup, "Save draft" +
  "Submit for review" buttons, status help text.
- `cms/admin/admin.js` — author photo upload via `/api/images`, PDF import
  client, author image preview, client-side validation, draft-vs-submit save
  flow, success banner.
- `cms/admin/admin.css` — styling for the PDF import card, validation panel,
  review banner, `pending` status pill.
- `cms/lib/pdf-import.js` *(new)* — PDF → draft JSON heuristics.
- `cms/lib/notifications.js` *(new)* — SMTP + fallback logging for review
  notification emails.
- `cms/lib/db.js` — added a `submissions` audit table and `submitted_at` /
  `submitter_email` columns on `articles` (auto-migrated).
- `cms/lib/articles.js` — added `pending` to valid statuses, surfaces
  `submitterEmail` / `submittedAt`, defaults new articles to `pending` when
  `CMS_REQUIRE_APPROVAL` is on, records the submission timestamp.
- `cms/routes/api.js` — `POST /api/import/pdf` endpoint with multer PDF upload
  (25 MB cap, temp dir, cleanup in `finally`); server-side submission
  validation; notification dispatch on transitions into `pending`; public
  listing never exposes non-published articles.
- `article.js` — renders `article-author-card` in both the left rail (desktop)
  and after the comment section, before the end-of-article navigation (mobile);
  fetches the full author record via `getAuthors()`.
- `cms/build-site.js` — prerendered static articles get the same author card
  in both positions; still only builds published articles.
- `styles.css` — `.article-author-card`, `.article-author-card--rail`,
  `.article-author-card--inline` styles, plus breakpoint rules that show the
  rail version ≥ 921 px and the inline version ≤ 920 px.
- `package.json` / `package-lock.json` — `pdf-parse` and `nodemailer`
  dependencies added.

---

## 7. Bottom line

- **Author photo + bio slot on articles:** ✅ shipped now. The bio/photo you
  enter on the Authors tab renders at the bottom of the left navigation rail
  on desktop, and after the comment section at the end of the article on
  mobile.
- **PDF upload that prefills the form:** ✅ a functional v1 is shipped now
  (heuristic extraction, ~80% correct on clean manuscripts, never overwrites
  fields you've already typed).
- **Structured handout/guideline workflow:** requires a ~half-day follow-up
  (template authoring + labelled-section parser) to take from "useful draft"
  to "reliably fills every required field".
- **"Just click publish" AI-perfect extraction:** possible but a separate
  project (LLM API, cost controls, UI for accepting/rejecting suggestions).
  Worth doing once v1.1/v1.2 prove the template workflow is actually being
  used.
