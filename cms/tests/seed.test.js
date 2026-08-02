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
