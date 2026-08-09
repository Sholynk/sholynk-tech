'use strict';

/**
 * Seeds the CMS database from the data that used to be hardcoded in index.js,
 * plus the long-form quantum computing article.
 *
 * Safe to re-run: existing slugs are updated rather than duplicated.
 */

const fs = require('node:fs');
const path = require('node:path');

const articles = require('./lib/articles');
const settings = require('./lib/settings');
const { db } = require('./lib/db');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'seed.json'), 'utf8'));

const LONGFORM_SLUG = 'the-rise-of-quantum-computing';

/**
 * Long-form bodies live beside seed.json as `<slug>.md` files, authored in
 * Markdown (article.js renders them via markdown.js). A seed entry whose slug
 * has a matching body file becomes a full article page; the others keep
 * pointing at their external links.
 */
function loadLongformBody(slug) {
  const file = path.join(__dirname, 'data', `${slug}.md`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');

  const storiesDir = path.join(__dirname, '..', 'article_stories');
  if (fs.existsSync(storiesDir)) {
    const directFile = path.join(storiesDir, `${slug}.md`);
    if (fs.existsSync(directFile)) return fs.readFileSync(directFile, 'utf8');

    const files = fs.readdirSync(storiesDir);
    for (const item of files) {
      if (!item.endsWith('.md')) continue;
      const baseName = item.replace(/\.md$/, '');
      const fileSlug = articles.slugify(baseName);
      if (fileSlug === slug || fileSlug.startsWith(slug) || slug.startsWith(fileSlug)) {
        return fs.readFileSync(path.join(storiesDir, item), 'utf8');
      }
    }
  }

  return null;
}

function estimateReadingTime(body = '') {
  const words = String(body).trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function toIsoDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

function upsert(payload) {
  const slug = articles.slugify(payload.slug || payload.title);
  const existing = articles.getBySlug(slug);
  if (existing) return articles.update(existing.id, payload);
  return articles.create({ ...payload, slug });
}

function run() {
  const heroBySlug = new Map();
  seed.heroSlides.forEach((slide, index) => {
    heroBySlug.set(articles.slugify(slide.title), { order: index, slide });
  });

  let created = 0;

  seed.articles.forEach((article) => {
    // An explicit slug in seed.json keeps an article's URL stable across rewrites.
    const slug = articles.slugify(article.slug || article.title);
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
      author: 'Busari Oluwashola',
      body: isLongform ? longformBody : '',
      // Articles without their own body keep pointing at the legacy page or a
      // category listing, exactly like before.
      externalLink: isLongform
        ? null
        : (article.link && !article.link.startsWith('article.html') ? article.link : null),
      seoTitle: article.seoTitle || null,
      seoDescription: article.seoDescription || null
    });
    created += 1;
  });

  // Hero slides: mark matching articles, and create standalone hero entries for
  // slides that have no matching article.
  seed.heroSlides.forEach((slide, index) => {
    const slug = articles.slugify(slide.title);
    // Hero headlines are often a longer version of the article title, so fall
    // back to a prefix match before creating a standalone hero entry.
    const existing = articles.getBySlug(slug)
      || articles.list({ status: 'all' }).find(
        (item) => slug.startsWith(item.slug) || item.slug.startsWith(slug)
      );
    if (existing) {
      articles.update(existing.id, { hero: true, heroOrder: index, img: slide.img });
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

  // The quantum piece is the flagship long-form story: put it in the hero too.
  const longform = articles.getBySlug(LONGFORM_SLUG);
  if (longform) {
    articles.update(longform.id, {
      hero: true,
      heroOrder: 1,
      featured: true,
      // Local hero image (see article-images/quantum/SOURCES.md for provenance).
      img: 'article-images/quantum/quantum-computer-chandelier.jpg',
      alt: 'Golden chandelier-like cryostat of a superconducting quantum computer, layered with control wiring'
    });
  }

  settings.set({});

  const total = db.prepare('SELECT COUNT(*) AS n FROM articles').get().n;
  console.log(`Seeded ${created} source articles. Database now holds ${total} articles.`);
  console.log(`Long-form article available at: /article.html?slug=${LONGFORM_SLUG}`);
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
