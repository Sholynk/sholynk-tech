'use strict';

/**
 * Seeds the CMS database.
 *
 * Content comes from two sources:
 *
 * 1. Long-form articles: every `article_stories/*.md` file becomes an article.
 *    The file's front-matter block (see cms/lib/frontmatter.js) supplies the
 *    metadata; the rest of the file is the article body. This is the single
 *    source of truth for full articles — edit the .md, re-run `npm run seed`.
 *
 * 2. Card-only entries and homepage hero slides: `cms/data/seed.json`.
 *    Card entries whose slug is already provided by a .md file are skipped so
 *    the Markdown version always wins.
 *
 * Safe to re-run: existing slugs are updated rather than duplicated.
 */

const fs = require('node:fs');
const path = require('node:path');

const articles = require('./lib/articles');
const settings = require('./lib/settings');
const { parseFrontMatter } = require('./lib/frontmatter');
const { db } = require('./lib/db');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'seed.json'), 'utf8'));

const LONGFORM_SLUG = 'the-rise-of-quantum-computing';

const STORIES_DIR = path.join(__dirname, '..', 'article_stories');

/**
 * Reads every Markdown story in article_stories/ and returns them sorted by
 * filename, each as { file, data (front matter), body }.
 */
function loadLongformStories() {
  const stories = [];
  if (!fs.existsSync(STORIES_DIR)) return stories;

  for (const item of fs.readdirSync(STORIES_DIR)
    .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
    .sort()) {
    const raw = fs.readFileSync(path.join(STORIES_DIR, item), 'utf8');
    const { data, body } = parseFrontMatter(raw);
    stories.push({ file: item, data, body: body.replace(/^\s+/, '') });
  }
  return stories;
}

/** Backwards-compatible body lookup for the old embedded seed bodies. */
function loadLongformBody(slug) {
  const file = path.join(__dirname, 'data', `${slug}.md`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');

  const directFile = path.join(STORIES_DIR, `${slug}.md`);
  if (fs.existsSync(directFile)) return fs.readFileSync(directFile, 'utf8');
  return null;
}

function estimateReadingTime(body = '') {
  const words = String(body).trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

function comparableSource(source = {}) {
  return {
    title: String(source.title || ''),
    publisher: String(source.publisher || ''),
    author: String(source.author || ''),
    publishedAt: String(source.publishedAt || ''),
    url: String(source.url || ''),
    type: source.type || 'journalism',
    doi: String(source.doi || ''),
    accessedAt: String(source.accessedAt || ''),
    supports: String(source.supports || '')
  };
}

function valuesMatch(key, current, incoming) {
  if (key === 'sources') {
    return JSON.stringify((current || []).map(comparableSource))
      === JSON.stringify((incoming || []).map(comparableSource));
  }
  if (Array.isArray(incoming)) return JSON.stringify(current || []) === JSON.stringify(incoming);
  if (typeof incoming === 'boolean') return Boolean(current) === incoming;
  if (incoming == null) return current == null || current === '';
  return String(current ?? '') === String(incoming);
}

function hasChanges(existing, payload) {
  return Object.entries(payload).some(([key, value]) => (
    key !== 'slug' && value !== undefined && !valuesMatch(key, existing[key], value)
  ));
}

function upsert(payload) {
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const slug = articles.slugify(cleanPayload.slug || cleanPayload.title);
  const existing = articles.getBySlug(slug);
  if (existing) return hasChanges(existing, cleanPayload) ? articles.update(existing.id, cleanPayload) : existing;
  return articles.create({ ...cleanPayload, slug });
}

/**
 * Seeds long-form articles from article_stories/*.md. Returns the set of
 * slugs they own so card-only seed entries cannot override them.
 */
function seedStories() {
  const ownedSlugs = new Set();
  for (const story of loadLongformStories()) {
    const { data, body } = story;

    // A .md file without a front-matter block (the `---` header at the very
    // top) is not an article — for example this folder's README. Skip it
    // instead of publishing it as an article.
    if (Object.keys(data).length === 0) {
      console.warn(`Skipping ${story.file}: no front-matter block at the top of the file.`);
      continue;
    }

    const title = data.title || story.file.replace(/\.md$/, '').replace(/[-_]+/g, ' ');
    const slug = articles.slugify(data.slug || title);

    upsert({
      slug,
      title,
      category: data.category || 'Technology',
      subcategory: data.subcategory || '',
      tags: data.tags || [],
      contentType: data.contentType || 'article',
      description: data.description || '',
      hook: data.hook || '',
      directAnswer: data.directAnswer || '',
      keyTakeaways: data.keyTakeaways || [],
      faqs: data.faqs || [],
      relatedSlugs: data.relatedSlugs || [],
      sources: data.sources || [],
      img: data.img || '',
      alt: data.alt || title,
      date: toIsoDate(data.date),
      readingTime: data.readingTime || estimateReadingTime(body),
      featured: Boolean(data.featured),
      status: data.status || 'published',
      scheduledAt: data.scheduledAt || null,
      reviewNotes: data.reviewNotes || '',
      canonicalUrl: data.canonicalUrl || null,
      author: data.author || 'Sholynk Editorial',
      authorSlug: data.authorSlug || 'oluwashola-busari',
      body,
      // Stories live at their own page; there is no external link.
      externalLink: null,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      // Hero placement is only written when the front matter actually declares
      // it. A story can also be promoted by a slide in seed.json (step 3), so
      // unconditionally writing `hero: false` here would clear that placement
      // and the two steps would overwrite each other on every sync — bumping
      // updated_at, and with it the dateModified in each page's structured
      // data, on articles whose content never changed.
      ...(data.hero === undefined ? {} : {
        hero: Boolean(data.hero),
        heroOrder: data.hero && Number.isFinite(Number(data.heroOrder)) ? Number(data.heroOrder) : null
      })
    });
    ownedSlugs.add(slug);
  }
  return ownedSlugs;
}

function run() {
  // 1. Long-form articles come from the Markdown files — the single source.
  const longformSlugs = seedStories();

  // 2. Everything else comes from seed.json (card-only entries). Slugs owned
  //    by a .md story are left untouched.
  let created = 0;

  seed.articles.forEach((article) => {
    const slug = articles.slugify(article.slug || article.title);
    if (longformSlugs.has(slug)) return;

    const longformBody = loadLongformBody(slug);
    const isLongform = longformBody !== null;
    upsert({
      slug,
      title: article.title,
      category: article.category,
      description: article.description,
      img: article.img,
      alt: article.alt || article.title,
      date: toIsoDate(article.date),
      readingTime: isLongform ? estimateReadingTime(longformBody) : article.readingTime,
      featured: Boolean(article.featured),
      status: 'published',
      author: 'Oluwashola Busari',
      authorSlug: 'oluwashola-busari',
      body: isLongform ? longformBody : '',
      externalLink: isLongform
        ? null
        : (article.link && !article.link.startsWith('article.html') ? article.link : null),
      seoTitle: article.seoTitle || null,
      seoDescription: article.seoDescription || null
    });
    created += 1;
  });

  // 3. Hero slides: mark matching articles, and create standalone hero entries
  //    for slides that have no matching article.
  seed.heroSlides.forEach((slide, index) => {
    const slug = articles.slugify(slide.title);
    // Hero headlines are often a longer version of the article title, so fall
    // back to a prefix match before creating a standalone hero entry.
    const existing = articles.getBySlug(slug)
      || articles.list({ status: 'all' }).find(
        (item) => slug.startsWith(item.slug) || item.slug.startsWith(slug)
      );
    if (existing) {
      const heroPayload = { hero: true, heroOrder: index, img: slide.img };
      if (hasChanges(existing, heroPayload)) articles.update(existing.id, heroPayload);
      return;
    }
    upsert({
      slug,
      title: slide.title,
      category: slide.category,
      description: slide.description,
      img: slide.img,
      alt: slide.title,
      hero: true,
      heroOrder: index,
      status: 'published',
      externalLink: slide.readMoreLink?.startsWith('index.html') ? slide.readMoreLink : null
    });
  });

  settings.set({});

  const total = db.prepare('SELECT COUNT(*) AS n FROM articles').get().n;
  console.log(`Seeded ${created} card articles + ${longformSlugs.size} Markdown stories. Database now holds ${total} articles.`);
  console.log(`Long-form article available at: /articles/${LONGFORM_SLUG}/ (legacy: /article.html?slug=${LONGFORM_SLUG})`);
}

function isArticleTableEmpty() {
  return db.prepare('SELECT COUNT(*) AS n FROM articles').get().n === 0;
}

function ensureSeeded() {
  if (!isArticleTableEmpty()) return false;
  console.log('No CMS articles found. Loading the starter content...');
  run();
  return true;
}

if (require.main === module) run();

module.exports = { run, ensureSeeded, isArticleTableEmpty, LONGFORM_SLUG };
