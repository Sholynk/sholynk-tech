'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate the test run from the development database.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sholynk-seed-test-'));
process.env.CMS_DATA_DIR = tmp;
process.env.CMS_DB_FILE = path.join(tmp, 'test.sqlite');
process.env.CMS_UPLOAD_DIR = path.join(tmp, 'uploads');

delete process.env.CMS_ADMIN_TOKEN;

const seed = require('../seed');
const articles = require('../lib/articles');
const { db } = require('../lib/db');

test.after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('ensureSeeded populates an empty CMS database once', () => {
  assert.equal(seed.isArticleTableEmpty(), true);

  assert.equal(seed.ensureSeeded(), true);
  const seededArticles = articles.list({ status: 'published' });
  assert.equal(seededArticles.length, 56);
  assert.equal(seededArticles.filter((article) => article.category === 'Game').length, 9);
  assert.ok(seededArticles.some((article) => article.slug === seed.LONGFORM_SLUG));
  assert.ok(seededArticles.some((article) => article.slug === 'distraction-by-design'));

  assert.equal(seed.ensureSeeded(), false);
  assert.equal(articles.list({ status: 'published' }).length, 56);
});

test('re-running the seed does not mark unchanged articles as modified', () => {
  const slug = 'distraction-by-design';
  db.prepare("UPDATE articles SET updated_at = '2000-01-01 00:00:00' WHERE slug = ?").run(slug);
  seed.run();
  assert.equal(articles.getBySlug(slug).updatedAt, '2000-01-01 00:00:00');
});

test('Markdown files without a front-matter block are skipped, not published', () => {
  const storiesDir = path.join(__dirname, '..', '..', 'article_stories');
  const probe = path.join(storiesDir, 'zz-not-an-article.md');
  fs.writeFileSync(probe, '# Just a note\n\nThis file has no front matter, so it must never become an article.\n');
  try {
    seed.run();
    const all = articles.list({ status: 'all' });
    assert.ok(
      !all.some((article) => article.slug === 'zz-not-an-article'),
      'a .md file without front matter must not be published as an article'
    );
  } finally {
    fs.rmSync(probe, { force: true });
  }
});

test('re-running the seed leaves every article untouched, including hero slides', () => {
  // The earlier test only checked one article, which happens to have no hero
  // slide. A story promoted by a slide in seed.json is written twice per run —
  // once by the Markdown step and once by the hero step — so the two can
  // overwrite each other indefinitely. That churns updated_at, and with it the
  // dateModified in each page's structured data, on content nobody edited.
  seed.run();

  const marker = '2000-01-01 00:00:00';
  db.prepare('UPDATE articles SET updated_at = ?').run(marker);

  seed.run();

  const touched = articles
    .list({ status: 'all' })
    .filter((article) => article.updatedAt !== marker)
    .map((article) => article.slug);

  assert.deepEqual(touched, [], 'a second seed run must not rewrite any article');
});

test('hero placement from seed.json survives repeated seeding', () => {
  seed.run();
  seed.run();

  const heroes = articles.list({ status: 'all' }).filter((article) => article.hero);
  assert.ok(heroes.length > 0, 'hero slides still promote their articles');

  // The Markdown step must not clear a placement that seed.json owns.
  const promoted = articles.getBySlug('mastering-the-art-of-coding');
  assert.equal(promoted.hero, true, 'a story promoted by a slide stays in the hero slider');
  assert.equal(promoted.heroOrder, 0);
});
