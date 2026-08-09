'use strict';

/**
 * Exports the CMS database to `content-fallback.json` at the repo root.
 *
 * The public pages prefer the live API, but fall back to this snapshot when the
 * Node server is not running (for example on a plain static host). Run this
 * after content changes if you deploy the site statically.
 */

const fs = require('node:fs');
const path = require('node:path');

const articles = require('./lib/articles');
const settings = require('./lib/settings');

/**
 * Builds the search-index snapshot used by articles.js (the site-wide search
 * box). Kept in sync with the database so descriptions and links never drift
 * from the article source of truth.
 */
function buildSearchIndex() {
  return articles.list({ status: 'published' }).map((article) => ({
    title: article.title,
    link: article.externalLink || `article.html?slug=${article.slug}`,
    category: article.category,
    description: article.description,
    img: article.img,
    alt: article.alt || article.title
  }));
}

function run() {
  const payload = {
    generatedAt: new Date().toISOString(),
    settings: settings.all(),
    articles: articles.list({ status: 'published' })
  };
  const target = path.join(__dirname, '..', 'content-fallback.json');
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);

  const searchTarget = path.join(__dirname, '..', 'articles.json');
  fs.writeFileSync(searchTarget, `${JSON.stringify(buildSearchIndex(), null, 2)}\n`);
  console.log(`Exported ${payload.articles.length} articles to ${path.relative(process.cwd(), target)}`);
  console.log(`Exported search index to ${path.relative(process.cwd(), searchTarget)}`);
}

if (require.main === module) run();

module.exports = { run };
