# Adding an Article to Sholynk Tech — A Beginner's Guide

> **The whole system in one sentence:** one file = one article. You write the
> article as a simple text file with a small "form" at the top, save it, and
> run one command. Everything else happens by itself.

---

## The 30-second version

1. Go to the `article_stories/` folder (the folder this guide lives in).
2. Create a new file called something like `my-new-article.md`.
3. Copy the **template** below into it and fill in your details.
4. Save the file.
5. Open a terminal in the project folder and run:

   ```bash
   npm run sync
   ```

6. Done! Open the site (`http://localhost:3000`) and your article is there.

---

## The one rule you must never break

**The front-matter block (the `---` section at the very top of the file) must
be the first thing in the file.** Nothing before it — not even a blank line.

Everything else is forgiving:

- Files without a front-matter block are **ignored** (so this guide file never
  becomes an article).
- You can name the file almost anything; `my-article.md` is fine.
- You can put the article file in any order; the site sorts by date.

---

## The template (copy this)

Create a new file in `article_stories/` and paste this:

```markdown
---
title: Your Article Title Here
slug: your-article-title-here
category: Technology
description: One or two sentences about the article. This is shown on the homepage card and in search.
img: Article cards images/Technology/article_card_01.jpg
alt: A short description of the image for people who cannot see it
date: 2026-08-09
author: Busari Oluwashola
---

## Introduction

Write your opening here. A short paragraph that hooks the reader works well.

## First Big Section

More paragraphs. Leave a blank line between paragraphs.

## Second Big Section

Keep going. Use **bold** for important words and [links](https://example.com) when useful.

## Conclusion

Wrap it up neatly.
```

---

## What each field means (fill this in)

| Field | Do I need it? | What it does |
| --- | --- | --- |
| `title` | **Yes** | The headline. Shown big at the top of the article and on the homepage card. |
| `slug` | Optional | The web address part: `article.html?slug=your-article-title-here`. If you leave it out, one is made automatically from the title (lowercase, dashes instead of spaces). Only use letters, numbers, and dashes. Make it unique — if two articles share a slug, the newer one overwrites the older one. |
| `category` | Optional | Which category page the article appears under. Use one of these **exactly** (capital letters matter): `Technology`, `AI Trends`, `Cryptocurrency`, `Game`, `Web 3`. Default: `Technology`. |
| `description` | **Yes** | 1–2 sentences shown on the homepage card, category pages, and search results. |
| `img` | Optional | The picture shown on the card. See "Where do I get an image?" below. If missing, a placeholder image is used. |
| `alt` | Optional | A plain-English description of the image (for screen readers, and shown if the image fails to load). Always fill it in — it's good practice. |
| `date` | Optional | `YYYY-MM-DD`, e.g. `2026-08-09`. Newest articles appear first. Default: today. |
| `readingTime` | Optional | E.g. `5 min read`. If omitted, it is estimated automatically from the word count — you can leave it out. |
| `featured: true` | Optional | Adds `featured: true` to mark the article as featured. |
| `hero: true` | Optional | Shows the article in the big rotating slideshow on the homepage. |
| `heroOrder: 0` | Optional | Used with `hero: true`. `0` = first slide, `1` = second, and so on. |
| `seoTitle` | Optional | The title shown in Google search results and browser tabs. Defaults to `title`. |
| `seoDescription` | Optional | The text shown under the title in Google results. Defaults to `description`. |
| `author` | Optional | The byline shown in the article header. Default: `Sholynk Editorial`. |

---

## Where do I get an image?

Two easy options:

**Option A — reuse an existing image.** Copy the `img:` line from any article
in the folder. Example:

```yaml
img: Article cards images/Technology/article_card_01.jpg
```

**Option B — use your own image.**

1. Create a folder for it, e.g. `article-images/5g-explained/`.
2. Drop your picture inside (`.jpg`, `.png`, `.webp`, `.gif`, or `.avif`, under 8 MB).
3. Reference it like this:

```yaml
img: article-images/5g-explained/5g-tower.jpg
```

Or use the admin dashboard: **Admin → Media library → Upload an image**, then
copy the URL it gives you (it looks like `/uploads/your-image.jpg`) into the
`img:` line.

---

## Worked example, end to end

Let's add a real article called **"Why 5G Matters"**.

**Step 1.** Create the file `article_stories/why-5g-matters.md`:

```markdown
---
title: Why 5G Matters for Everyday Life
slug: why-5g-matters
category: Technology
description: 5G is more than faster downloads. It is the network that connects cars, factories, hospitals, and cities in real time.
img: Article cards images/Technology/article_card_04.jpg
alt: A smartphone showing a 5G network signal icon
date: 2026-08-09
hero: true
heroOrder: 0
author: Busari Oluwashola
---

## Introduction

5G is the fifth generation of mobile networks...

## What Makes 5G Different

...

## Conclusion

...
```

**Step 2.** Save the file.

**Step 3.** In the terminal, from the project folder (`sholynk-tech/`), run:

```bash
npm run sync
```

You should see something like:

```
Seeded 50 card articles + 4 Markdown stories. Database now holds 57 articles.
Exported 57 articles to content-fallback.json
Exported search index to articles.json
```

(Your numbers may differ — the point is the story count went up by one.)

**Step 4.** Open `http://localhost:3000`. Your article appears on the homepage
(and in the hero slideshow, because we set `hero: true`). Its page lives at:

```
http://localhost:3000/article.html?slug=why-5g-matters
```

---

## Editing an article

1. Open the `.md` file for that article.
2. Make your changes (text, title, image, anything).
3. Save, then run `npm run sync` again.
4. Refresh the site.

That's it — the update replaces the old version everywhere (article page,
homepage card, search).

> **Tip:** if you change the `slug`, the site treats it as a *new* article and
> the old web address stops working. Keep the slug the same unless you really
> mean to rename the page.

## Removing an article

1. Delete the `.md` file.
2. Run `npm run sync`.
3. The article disappears from the site.

(Comments that readers left on it stay in the database — you can still see and
delete them from **Admin → Comments**.)

---

## Writing style tips (so articles look consistent)

- Start the article with `## Introduction` (the site's other articles do).
- Use `##` for main sections — they automatically become the **table of
  contents** on the article page.
- Use `###` for sub-sections inside a main section.
- Leave a blank line between paragraphs.
- Don't use em dashes (—) between words; use commas, semicolons, or full stops
  instead.
- Use correct compound hyphens where English requires them
  (`real-world`, `open-source`, `problem-solving`).

---

## Troubleshooting checklist

**"I ran `npm run sync` but the article isn't on the site."**

- [ ] Is the file in the `article_stories/` folder, with a `.md` ending?
- [ ] Does the file start with `---` on the very first line, and is there a
      matching `---` at the end of the header block?
- [ ] Did you include a `title` line?
- [ ] Is the site server running? (`npm start`, then open `http://localhost:3000`)
- [ ] Hard-refresh your browser: `Ctrl + Shift + R` (Windows) / `Cmd + Shift + R` (Mac).
- [ ] Check the article's own URL directly:
      `http://localhost:3000/article.html?slug=your-slug`
- [ ] Look at the terminal output of `npm run sync` — did it print
      `Skipping ...` for your file? If so, the front-matter block is missing.

**"The article shows but on the wrong category page."**

Check that the `category` value matches one of these exactly: `Technology`,
`AI Trends`, `Cryptocurrency`, `Game`, `Web 3`.

**"My image doesn't show."**

- [ ] Does the file exist at the path in the `img:` line?
- [ ] Check the spelling and the folder name — paths are case-sensitive.
- [ ] Is it a supported type (`.jpg`, `.png`, `.webp`, `.gif`, `.avif`) and under 8 MB?

**"The site shows old content even after `npm run sync`."**

- Stop the server (`Ctrl + C` in the terminal running `npm start`) and start it
  again with `npm start`. The site reads from the database, which `sync` just
  updated, but a restart removes any doubt.

---

## Words you'll see (a mini glossary)

| Word | Meaning |
| --- | --- |
| **Front matter** | The block at the top of the file between `---` and `---` that holds the article's details (title, category, image...). |
| **Slug** | The part of the web address that identifies the article, e.g. `why-5g-matters` in `article.html?slug=why-5g-matters`. |
| **Sync** | `npm run sync` — the command that reads your `.md` files, updates the site's database, and refreshes the search index and offline copy. |
| **Fallback files** | `content-fallback.json` and `articles.json` — automatically generated copies used when the site is hosted without the Node server. **Never edit them by hand**; `npm run sync` rewrites them. |
| **Card** | The little box (image + title + description) that links to an article on the homepage. |

---

## Golden rules (print these)

1. One article = one `.md` file in `article_stories/`.
2. The `---` front matter must be the very first thing in the file.
3. Write the article with `##` headings and blank lines between paragraphs.
4. Run `npm run sync` after adding, editing, or deleting any article.
5. Never hand-edit `content-fallback.json`, `articles.json`, or the
   long-form articles inside `cms/data/seed.json` — they are all generated.
6. Keep slugs unique and stable.
