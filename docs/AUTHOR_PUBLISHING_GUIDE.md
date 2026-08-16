# Author's Guide: Publishing a Sholynk Article

**How to shape an article so it fits the Sholynk Formula *and* the Sholynk Tech website layout.**

Audience: writers and contributing authors publishing on Sholynk Tech.
Companion documents: `THE UPDATED SHOLYNK FORMULA` (editorial framework),
`article_stories/README.md` (beginner mechanics), `docs/EDITORIAL_AND_SEO_HANDOVER.md`
(build and SEO reference).

---

## 0. The one thing to understand first

The Sholynk website does **not** render one long blob of prose. The article page is
assembled from *slots*. Some slots are filled by the **front matter** (the small
metadata block at the top of your file), and the rest is filled by your **Markdown
body**.

That means several stages of the Sholynk Formula are **not written as body text at
all** — if you type them into the body, they will render as ordinary paragraphs,
lose their designed styling, and be invisible to the site's structured data (schema),
which is what AI search systems and Google read.

```
FORMULA STAGE                   WHERE IT LIVES ON THE SITE
1  SEO title              →  front matter: title / seoTitle        (page <h1>)
2  Byline                 →  front matter: author / authorSlug     (byline + author card)
3  Narrative hook         →  front matter: hook  (standfirst)  +  body opening
4  Direct answer          →  front matter: directAnswer            ("Quick answer" callout)
5  Key takeaways          →  front matter: keyTakeaways            ("Key takeaways" callout)
6  Understanding          →  body  ## heading
7  Why it matters         →  body  ## heading
8  Real-world apps        →  body  ## heading
9  Benefits               →  body  ## heading
10 Limitations/risks      →  body  ## heading
11 Evidence & sources     →  front matter: sources                 (Sources section + schema)
12 FAQ                    →  front matter: faqs                    (FAQ accordion + FAQPage schema)
13 Conclusion             →  body  ## heading
14 Related articles       →  front matter: relatedSlugs            ("Read next" grid)
```

**Golden rule:** stages 1, 2, 4, 5, 11, 12 and 14 are *metadata*. Stages 3, 6, 7, 8,
9, 10 and 13 are *body*. Stage 3 lives in both: a one-sentence standfirst in front
matter, and the full hook as the first paragraphs of the body.

---

## 1. Before you write: pre-flight decisions

Fix these five things before drafting. They determine how the article is filed,
displayed and discovered.

| Decision | Options / rules |
| --- | --- |
| **Category** | Exactly one of `Technology`, `AI Trends`, `Cryptocurrency`, `Game`, `Web 3`. Capitalisation matters — a typo silently files the piece under the wrong nav tab. |
| **Subcategory** | Free text, more precise (e.g. `Emerging Computing`, `DeFi`, `Esports`). Optional but recommended. |
| **Content type** | One of `article`, `news`, `guide`, `analysis`, `opinion`, `review`. It is printed in the kicker above the headline, so choose honestly: an `analysis` label on a news round-up misleads the reader. |
| **Slug** | Lowercase, hyphenated, permanent. It becomes `/articles/<slug>/`. Never change it after publication — it breaks links, and reactions/comments are keyed to it. |
| **Central question** | Write down, in one sentence, the question the article answers. Stage 4 (`directAnswer`) is literally that answer. If you cannot write the question, the article does not yet have a subject. |

---

## 2. Step-by-step: building the file

### Step 1 — Create the file

One article = one Markdown file in `article_stories/`.

```
article_stories/what-are-ai-agents.md
```

Name it after the slug. The front-matter block `---` must be the **very first
characters in the file** — no blank line, no title above it. A file without front
matter is ignored by the build.

### Step 2 — Write the front matter (the Formula's metadata half)

Every value must sit on **one line**. Arrays and objects must be valid JSON on that
single line — the parser is deliberately minimal, and a multi-line YAML list will be
silently dropped.

```markdown
---
title: What Are AI Agents and How Do They Work?
slug: what-are-ai-agents
category: AI Trends
subcategory: Autonomous Systems
contentType: guide
description: AI agents interpret goals, plan actions and use tools to complete multi-step tasks. This guide explains how they work, where they are deployed and where they still fail.
img: article-images/ai-agents/agent-orchestration.jpg
alt: Diagram-style illustration of a language model calling external tools in sequence
date: 2026-08-16
author: Busari Oluwashola
authorSlug: oluwashola-busari
tags: ["ai agents", "autonomous systems", "tool use", "llm orchestration"]
hook: Software has traditionally waited for humans to tell it what to do. AI agents are beginning to change that relationship.
directAnswer: An AI agent is a software system capable of interpreting a goal, planning actions, using tools and executing multi-step tasks with varying degrees of autonomy.
keyTakeaways: ["Agents combine a model, memory, planning and tool access rather than being a single new technology.", "Most production deployments today are narrow and supervised, not fully autonomous.", "Reliability, permissions and cost remain the binding constraints on adoption."]
faqs: [{"question":"What is the difference between an AI agent and a chatbot?","answer":"A chatbot responds to messages. An agent plans a sequence of actions and can call external tools to change something in the world."}]
sources: [{"title":"Function calling documentation","publisher":"OpenAI","publishedAt":"2026-05-02","url":"https://platform.openai.com/docs/guides/function-calling","type":"official","accessedAt":"2026-08-16","supports":"Description of how models invoke external tools"}]
relatedSlugs: ["mastering-the-art-of-coding", "the-rise-of-quantum-computing"]
seoTitle: What Are AI Agents and How Do They Work?
seoDescription: A clear explanation of AI agents, how they plan and use tools, where they are genuinely deployed, and the reliability and security limits that still apply.
status: published
---
```

#### Field-by-field, mapped to the Formula

**`title` — Formula stage 1.**
Rendered as the page `<h1>`, the breadcrumb tail, the homepage card headline and the
browser tab. Concise, specific, descriptive. No clickbait, no keyword stuffing.
Keep it under **70 characters** or the build raises an advisory warning and Google
truncates it. If the editorial headline needs to be longer, keep it in `title` and
put a shorter version in `seoTitle`.

**`author` / `authorSlug` — Formula stage 2.**
Default byline is `Busari Oluwashola`, and `authorSlug` links the byline to the author
profile (default `oluwashola-busari`). The name appears twice on the page: in the meta
row under the headline, and in the author card in the reading rail and at the end of
the article. Never invent credentials — the author card text is a published claim.

**`description`.**
Not a Formula stage, but the most-seen sentence you will write. It is the card text on
the homepage, the category pages, the "Read next" grid and the search index, plus the
default meta description and social-share text. Aim for **1–2 sentences, under 170
characters**; longer triggers a warning and gets cut off in search results. It should
read as a promise the article keeps, not a teaser that withholds.

**`hook` — Formula stage 3 (part one).**
This becomes the **standfirst**: the larger grey line directly beneath the headline.
One or two sentences, maximum. If you omit it, the site falls back to `description`,
which wastes the slot — the standfirst is the reader's first taste of your voice.
Write the tension, not a summary.

**`directAnswer` — Formula stage 4.**
Rendered as the **"Quick answer" callout** — a bolt-icon box at the very top of the
article body, above everything else. Constraints:

- It must **stand alone**. A reader who reads only this box should have the correct
  answer. No "as discussed below", no pronouns referring to the headline.
- Plain text only. Markdown, links and bold are escaped here and will show as literal
  characters.
- 1–3 sentences. This is also the passage retrieval systems are most likely to quote.
- Omit the field entirely if the article has no single central question (a news
  round-up, an opinion essay). An absent callout is better than a forced one.

**`keyTakeaways` — Formula stage 5.**
Rendered as the **"Key takeaways" callout** under the quick answer, with a green tick
heading. JSON array of **3–6** strings. Each item must be a complete, self-contained
statement with a verb — not a keyword fragment. Plain text only; no Markdown.
Bad: `"Cost and scalability"`. Good: `"Running agents in production currently costs
more per task than the workflows they replace."`

**`img` / `alt`.**
The hero image, also reused as the card image everywhere else. Rules:

- Path is **relative to the repository root** and **case-sensitive**. Put bespoke
  images in `article-images/<slug>/`; or reuse a stock card from `Article cards images/<Category>/`.
- Supported: `.jpg`, `.png`, `.webp`, `.gif`, `.avif`, under 8 MB. The build will fail
  if the file does not exist.
- The hero renders at **16:9** and is cropped with `object-fit: cover` — keep the
  subject centred and avoid text near the edges. Supply at least **1600 px wide**;
  the build generates 640/1024/1600 WebP derivatives automatically. Never edit
  `generated-images/` yourself.
- `alt` is mandatory and doubles as the visible **caption** under the hero. So write
  it as a real descriptive sentence, not `"AI agents"`. It has two audiences: screen
  readers and every sighted reader.

**`date`.**
`YYYY-MM-DD`. Drives the visible dateline, the sort order on the homepage, the
sitemap `lastmod` and the schema. Must be accurate — dating is an integrity rule, not
a formatting detail. For crypto and news pieces the date is part of the claim.

**`readingTime`.**
Optional. Estimated automatically at 200 words per minute; only override it if the
automatic figure is misleading (heavy code or tables).

**`tags`.**
JSON array of lowercase search terms. Feeds the site search. Use genuine entities and
concepts, 4–8 of them, not every synonym you can think of.

**`sources` — Formula stage 11.**
JSON array of source records. This is the only mechanism that produces the visible
**Sources** section at the foot of the article *and* emits `citation` URLs into the
Article schema. Each record:

```json
{
  "title": "Exact title of the source",
  "publisher": "Publishing organisation",
  "author": "Named author, if available",
  "publishedAt": "2026-05-02",
  "url": "https://publisher.example/report",
  "type": "primary | official | research | journalism | reference | other",
  "doi": "",
  "accessedAt": "2026-08-16",
  "supports": "The exact statement in the article this source supports"
}
```

- `title` and an absolute `http(s)` `url` are required; the build fails without them.
- `supports` is where the Sholynk integrity standard is enforced in practice: name the
  specific claim. If you cannot state which sentence a source supports, it is
  decoration, not evidence — remove it.
- Match the level to the claim: **primary/official** for technical, product and
  regulatory facts; **journalism** for reporting and context; **research** for
  scholarly claims. For a ResearchGate or repository link, verify and cite the
  underlying paper, journal and DOI; do not assume peer review.
- An article with no sources still builds, but produces an advisory warning. That
  warning is the system asking you a question: *should this piece really have none?*
  Never satisfy it with a fabricated or approximate citation.
- Keep the in-body attribution too: sources listed at the foot do not remove the need
  to attribute a claim inline, next to where it is made (see §3).

**`faqs` — Formula stage 12.**
JSON array of `{"question": "...", "answer": "..."}` objects. Rendered as an
accordion below the body and emitted as `FAQPage` JSON-LD — this is one of the highest
value slots on the page for both search and AI retrieval. Rules:

- Plain text only, in both fields; Markdown is escaped.
- Each answer must be complete on its own, in 1–3 sentences.
- 3–6 entries is the healthy range. Ask questions a real reader would ask *after*
  finishing the article, not restatements of your headings. Do not manufacture FAQs.

**`relatedSlugs` — Formula stage 14.**
JSON array of **existing** slugs, lowercase and hyphenated. Powers the "Read next"
grid. Choose 2–3 genuinely related articles in the same topic cluster. Note this is
*in addition to* contextual in-body links (§3), not a replacement for them.

**`seoTitle` / `seoDescription`.**
Only when the editorial headline and the search headline should differ. Limits: 70 and
170 characters. Must be unique per article.

**Placement and workflow flags.**
`featured: true` marks a highlighted card. `hero: true` plus `heroOrder: 0` puts the
article in the homepage slideshow — hero images must be strong at full width.
`status:` is `published`, `draft` or `scheduled` (`scheduled` also requires
`scheduledAt`). `canonicalUrl` is generated automatically; only override it, with an
absolute HTTPS URL, if the piece is syndicated. `reviewNotes` holds internal notes and
is never rendered publicly.

### Step 3 — Write the body (the Formula's narrative half)

The body starts immediately after the closing `---`. Its first element should be a
`##` heading.

The site builds the **table of contents in the reading rail automatically from your
`##` headings** (only `##` — `###` subheadings are not listed, and the TOC appears
only when there are **at least three** `##` sections), so your section headings *are*
the article's navigation. Vague
headings ("Some thoughts", "More on this") produce a useless TOC. Descriptive
headings produce both a good TOC and clean semantic structure for retrieval systems.

Recommended body skeleton, following the standard article flow:

```markdown
## Introduction
Narrative hook expanded: development → context → problem/change → why the reader
should care. Three to six paragraphs. Do not repeat the Quick answer box verbatim;
the reader has just read it directly above.

## Understanding <the technology or topic>
### What is it?
### How it works
Definitions, mechanism, terminology, worked example. Move the reader from unfamiliar
to familiar to technically competent. Explain jargon at first use.

## Why It Matters
Consequences for the stakeholders who are actually affected. Name them.

## Real-World Applications
### <Sector or use case>
Concrete, evidence-supported deployments. Label clearly what is shipping today
versus what is a pilot, a research result or a projection.

## Benefits and Opportunities
Practical, measurable value. No "revolutionary", no "game-changing".

## Limitations, Risks and Trade-offs
Only the risks that genuinely apply: reliability, security, privacy, cost,
scalability, regulation, ethics, environmental impact, adoption barriers.

## Conclusion
Answer "so what?". Synthesise; do not summarise. Then the forward view.
```

Notice what is **absent** from the body: no "Key takeaways" section, no "FAQ"
section, no "Sources" section, no "Related articles" section, and no repeat of the
title or byline. The page renders all of those for you, in the correct order and
style, from the front matter. Writing them into the body produces duplicates.

Section ordering is an architecture, not a cage: sections may be merged, renamed to
suit the subject, or dropped where they do not apply. What should not change is the
*sequence* — hook, then explain, then contextualise, apply, evaluate, conclude.

### Step 4 — Length, formatting and the house style

**Headings.** `##` for main sections (these become the TOC), `###` for subsections,
`####` sparingly. Never use `#` in the body — the `<h1>` is the article title, and a
second one damages the document outline.

**Paragraphs.** Blank line between them. Two to five sentences each. The column is
narrow by design; a twelve-line paragraph becomes an unreadable wall on mobile.

**Emphasis.** `**bold**` for the first appearance of a key term (the stylesheet gives
bold a distinct treatment); `*italics*` sparingly.

**Lists.** `-` for unordered, `1.` for ordered. Introduce every list with a full
sentence ending in a colon. Lists are for genuinely parallel items — do not fragment
an argument into bullets to avoid writing prose.

**Links.** `[descriptive anchor](url)`. Never "click here" or a bare URL. Internal
links use the canonical form `/articles/<other-slug>/`. Two to five contextual
internal links inside the body is a healthy density, and they are what actually build
the topic cluster.

**Blockquotes.** `>` renders as a styled pull-quote with a rule. Use for real quoted
material or a genuinely striking line — not for ordinary emphasis.

**Images inside the body.**

```markdown
![Screen capture of an agent framework executing a three-step plan](article-images/what-are-ai-agents/plan-execution.png)

*Figure 1. The planner emits three tool calls before returning a result.*
```

The alt text is required, and the build **fails** if the file does not exist. An
italic paragraph immediately after an image is styled automatically as a caption, so
use that pattern rather than writing "Caption:".

**Tables.** Standard Markdown pipe tables render with the site's table styling. Keep
them to three or four columns — wide tables scroll awkwardly on phones.

**Code.** Fenced blocks with a language tag (` ```python `). Inline code in backticks.

**Allowed raw HTML.** Prefer pure Markdown. If you must use HTML, only this set
survives sanitisation: `a, abbr, b, blockquote, br, code, del, details, div, em,
figcaption, figure, h1–h6, hr, i, img, kbd, li, mark, ol, p, pre, s, small, span,
strong, sub, summary, sup, table, tbody, td, tfoot, th, thead, tr, ul`. Anything else
— `script`, `iframe`, `style`, embeds, forms, inline event handlers, inline `style`
attributes — is stripped. Embedded videos and third-party widgets will not render;
link to them instead.

**Length.** A published article must be **at least 300 words** or the build fails.
There is no upper limit and no target: 1,200 words that answer the question fully
beat 2,500 words padded to hit a number.

**Language.** **Strictly British English. There is no exception and no "by default".**
An article containing American spellings is not ready to publish.

- `-ise` / `-isation`, never `-ize` / `-ization`: `optimise`, `organisation`,
  `analyse`, `summarise`, `recognise`, `prioritise`, `specialised`.
- `-our`, not `-or`: `behaviour`, `colour`, `favour`, `labour`, `honour`.
- `-re`, not `-er`: `centre`, `metre`, `fibre`, `theatre`.
- `-ce` for nouns, `-se` for verbs: a `licence` / to `license`, a `practice` /
  to `practise`, `defence`, `offence`.
- Doubled `l` before a suffix: `travelling`, `modelling`, `labelled`, `cancelled`,
  `fuelled`.
- Also: `programme` (except a computer `program`), `catalogue`, `dialogue`,
  `enrol`, `fulfil`, `judgement`, `towards`, `learnt`, `amongst`, `whilst`
  (used sparingly), `maths` not `math`.
- Dates read `16 August 2026`, not `August 16, 2026`. Note that the `date` front-matter
  field is a separate, machine-readable `YYYY-MM-DD` value and is unaffected.
- Punctuation follows British convention: full stops and commas go **outside** closing
  quotation marks unless they belong to the quoted material, and single quotation
  marks are acceptable for quotes within quotes.
- Collective nouns take the British reading where it is natural: "the team are
  divided" is acceptable; "the company is" remains singular.

Two exceptions, both mechanical rather than editorial:

1. **Quoted material and source titles are never altered.** If a cited American paper
   is titled "Analyzing Model Behavior", reproduce it exactly. The same applies to
   direct quotations.
2. **Code, identifiers, file paths and API field names are reproduced as written.**
   This repository's own code contains `sanitizeHtml`, `optimize` and similar; in
   prose you write "sanitisation", but the function name stays `sanitizeHtml`.

Set your editor's spellchecker to English (United Kingdom) before you start, and read
the piece once specifically for spelling before running the build. The build does not
check spelling — this is enforced editorially, not by tooling.

**Punctuation.** No em dashes between words — use commas, semicolons or full stops.
Keep correct compound hyphens: `real-world`, `open-source`, `problem-solving`,
`multi-step`.

**Banned register.** "revolutionary", "game-changing", "in today's rapidly evolving
world", "unleash", "supercharge", and any sentence that would fit in a press release.
If a technology genuinely is a step change, demonstrate it with evidence rather than
asserting it with an adjective.

### Step 5 — Verify claims before you build

Work through the article and, for every factual statement, decide which of four
categories it belongs to, and make the category visible to the reader in the prose:

1. **Established fact** — state plainly, with a source.
2. **Reported claim** — attribute: "According to Reuters…", "The company says…".
3. **Your interpretation** — signal it: "This suggests…", "The likely consequence is…".
4. **Speculation or forecast** — label it: "If current trends hold…", "Researchers
   expect, though this is unproven…".

Never fabricate a source, quote, statistic, expert or credential. Never present an
inference as reported fact. Never claim first-hand experience you do not have. Where
evidence conflicts or is thin, say so in the text and flag it for editorial review
rather than resolving it silently.

### Step 6 — Build, validate and preview

From the repository root:

```bash
npm run sync     # imports Markdown, exports JSON, validates, generates pages and images
npm test         # integration suite
```

`npm run sync` will **fail** on: missing required fields, a duplicate or malformed
slug, a body under 300 words, a missing image file, malformed JSON in `tags`,
`keyTakeaways`, `faqs`, `sources` or `relatedSlugs`, an FAQ missing a question or
answer, a source missing a title or absolute URL, an unsupported `contentType`,
`status` or source `type`, or a non-HTTPS `canonicalUrl`.

It will **warn** (without failing) on an over-long SEO title or description, and on an
article with no recorded sources. Read the warnings; do not silence them with
invented content.

Then preview both routes with `npm start`:

- `http://localhost:3000/articles/<slug>/` — the canonical, pre-rendered page.
- `http://localhost:3000/article.html?slug=<slug>` — the legacy dynamic route, still
  supported for existing links.
- `http://localhost:3000/` — check the card and, if you set `hero: true`, the slide.

### Step 7 — Read the rendered page, not your draft

Check on a phone-width window as well as desktop:

- Does the **standfirst** work under the headline, or does it read as a duplicate of
  the description?
- Does the **Quick answer** box answer the question on its own?
- Do the **Key takeaways** survive being read in isolation?
- Does the **table of contents** in the rail read like a useful outline of the piece?
- Is the **hero image** cropped sensibly at 16:9?
- Do the **FAQ** accordion, **Sources** list and **Read next** cards all appear, and
  do the source links resolve?
- With JavaScript disabled, is the full article still there? (It should be — the page
  is pre-rendered.)

### Step 8 — Commit

Commit the Markdown source together with everything the build generated:
`content-fallback.json`, `articles.json`, `articles/<slug>/`, `generated-images/`,
`sitemap.xml` and `robots.txt`. Never hand-edit any of those generated files, and
never hand-edit `cms/data/seed.json` long-form entries.

If you edit an article later: change the `.md` file, keep the slug, re-run
`npm run sync`, and commit again. Deleting the `.md` file and re-syncing removes the
article from the site.

---

## 3. Quick reference: which slot does this go in?

| You want to… | Do this |
| --- | --- |
| Give the headline | `title` (and `seoTitle` if the search version differs) |
| Set the byline | `author` + `authorSlug` |
| Add the line under the headline | `hook` |
| Give a standalone answer | `directAnswer` |
| Summarise the essentials | `keyTakeaways` (3–6, JSON array) |
| Add a section of prose | `##` heading in the body |
| Add a subsection | `###` heading in the body |
| Cite a source | Inline attribution in the prose **and** a record in `sources` |
| Answer follow-up questions | `faqs` (JSON array) |
| Link to other Sholynk pieces | `relatedSlugs` **and** contextual body links |
| Add a picture | `img`/`alt` for the hero; `![alt](path)` plus an italic caption in the body |
| Hold a piece back | `status: draft`, or `status: scheduled` + `scheduledAt` |
| Leave a note for the editor | `reviewNotes` (never rendered publicly) |

---

## 4. Common mistakes on this site

1. **Writing "Key Takeaways" as a body heading.** It renders as plain prose and the
   designed callout stays empty. Use `keyTakeaways`.
2. **Writing a "Sources" or "FAQ" section in the body.** Duplicates the generated
   sections and skips the schema entirely.
3. **Markdown inside front matter.** `directAnswer`, `keyTakeaways`, `faqs` and
   `hook` are escaped as plain text. Links and bold will appear as literal characters.
4. **Multi-line JSON in front matter.** The parser reads one line per field. A list
   broken across lines is silently discarded — and you will only notice when the
   callout does not appear.
5. **A quick answer that depends on the headline.** "It is a system that…" is not a
   standalone answer.
6. **`relatedSlugs` pointing at articles that do not exist yet.** The grid silently
   drops them. Publish the target first, or leave it out.
7. **Case-wrong image paths.** `Article cards images/technology/...` fails; the folder
   is `Technology`.
8. **Changing a slug after publication.** It orphans the old URL and detaches existing
   reactions and comments.
9. **A `description` written as a teaser.** It is the card text on every listing page —
   it must inform, not tantalise.
10. **Editing generated files** in `articles/`, `content-fallback.json` or
    `articles.json`. The next sync overwrites them.
11. **American spellings.** `optimize`, `behavior`, `center`, `defense`, `traveling`.
    Nothing in the build catches these, so they reach the reader. Set the spellchecker
    to English (United Kingdom) and proofread for it deliberately.

---

## 5. Pre-publication checklist

Editorial (from the Sholynk Formula):

- [ ] The title clearly communicates the subject and is under 70 characters.
- [ ] The byline and author profile link are correct; no fabricated credentials.
- [ ] The opening carries a genuine narrative hook, not a definition.
- [ ] The central question is answered clearly and standalone in `directAnswer`.
- [ ] Key takeaways are 3–6 useful, complete statements.
- [ ] The technology or topic is explained from unfamiliar to competent.
- [ ] The article explains why the subject matters, to named stakeholders.
- [ ] Applications are evidence-supported, with deployment distinguished from pilots.
- [ ] Benefits are stated without hype or banned marketing register.
- [ ] Only the limitations and risks that genuinely apply are discussed.
- [ ] Important claims carry inline attribution and a matching `sources` record.
- [ ] Every source is real, traceable, correctly levelled, and `supports` a named claim.
- [ ] Fact, reported claim, interpretation and speculation are distinguishable in the prose.
- [ ] FAQs are genuine reader questions, not SEO filler.
- [ ] The conclusion synthesises rather than repeats.
- [ ] **Strictly British English** throughout (`-ise`, `-our`, `-re`, `licence`/`license`,
      `travelling`), checked with a UK spellchecker; quoted titles and code identifiers
      left exactly as written.
- [ ] No em dashes between words; jargon explained at first use.

Technical (specific to this website):

- [ ] Front matter is the first thing in the file; every value is on one line.
- [ ] `slug` is lowercase-hyphenated, unique and final.
- [ ] `category` matches one of the five exactly.
- [ ] `contentType` honestly describes the piece.
- [ ] `img` exists at the given path, is at least 1600 px wide and reads well at 16:9.
- [ ] `alt` is a descriptive sentence (it is also the visible caption).
- [ ] `description` is 1–2 sentences, under 170 characters.
- [ ] All JSON fields are valid single-line JSON.
- [ ] `relatedSlugs` point at articles that already exist.
- [ ] Body uses `##`/`###` only, with at least three `##` sections forming a sensible TOC.
- [ ] Body is 300+ words with no unnecessary padding.
- [ ] 2–5 contextual internal links with descriptive anchors.
- [ ] `date` is accurate; `status` is correct.
- [ ] `npm run sync` and `npm test` pass, warnings read and understood.
- [ ] Both `/articles/<slug>/` and `/article.html?slug=<slug>` reviewed, on desktop and mobile.
- [ ] Markdown plus all generated output committed together.

---

## 6. The principle behind all of it

**HOOK → EXPLAIN → ANSWER → CONTEXTUALISE → APPLY → EVALUATE → EVIDENCE → EXTEND**

**PEOPLE FIRST. EVIDENCE FIRST. UNDERSTANDING FIRST.**

The front matter and the slots exist so that the machinery — search visibility,
structured data, AI citation readiness — is handled by the system rather than by you
bending your prose around it. Fill the slots accurately and truthfully, then spend
your remaining effort on the only thing the system cannot do: writing something a
reader is genuinely better off for having read.
