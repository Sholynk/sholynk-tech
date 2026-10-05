'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sholynk-runtime-pages-'));
process.env.CMS_DATA_DIR = tmp;
process.env.CMS_DB_FILE = path.join(tmp, 'test.sqlite');
process.env.CMS_UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.SITE_URL = 'https://publication.example';
delete process.env.CMS_ADMIN_TOKEN;

const articles = require('../lib/articles');
const authors = require('../lib/authors');
const { renderArticlePage, renderMarkdown, schemaFor } = require('../lib/article-page');
const app = require('../server');

let server;
let base;
let article;

test.before(async () => {
  article = articles.create({
    title: 'Runtime database story',
    slug: 'runtime-database-story',
    category: 'Technology',
    description: 'Rendered from the current database row.',
    body: '## First section\n\nSafe body.\n\n## Second section\n\nMore.\n\n## Third section\n\nEnd.\n\n<script>alert(1)</script>',
    img: 'Images and Assets/page_logo.png',
    alt: 'Sholynk logo',
    status: 'published',
    authorSlug: 'oluwashola-busari'
  });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('server-side article renderer uses live records and emits crawlable HTML', async () => {
  const html = await renderArticlePage({
    article,
    articles: [article],
    authors: authors.list(),
    origin: 'https://publication.example'
  });
  const dom = new JSDOM(html);
  const document = dom.window.document;

  assert.equal(document.querySelector('#articleRoot')?.dataset.serverRendered, 'true');
  assert.equal(document.querySelector('h1')?.textContent, 'Runtime database story');
  assert.equal(document.querySelectorAll('.article-body h2').length, 3);
  assert.ok(document.querySelector('.article-toc'));
  assert.equal(document.querySelector('.article-body script'), null);
  assert.equal(document.querySelector('link[rel="canonical"]')?.href,
    'https://publication.example/articles/runtime-database-story/');
  assert.ok(document.querySelector('script[type="application/ld+json"]'));
  assert.match(html, /\.\.\/\.\.\/engagement\.js/);
  assert.doesNotMatch(html, /data-prerendered|content-fallback|articles\.json/);
});

test('clean article route returns current database content without a generated file', async () => {
  let response = await fetch(`${base}/articles/runtime-database-story/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Runtime database story/);

  articles.update(article.id, { title: 'Updated without rebuilding' });
  response = await fetch(`${base}/articles/runtime-database-story/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Updated without rebuilding/);
  assert.equal(fs.existsSync(path.join(ROOT, 'articles', 'runtime-database-story', 'index.html')), false);
});

test('robots and sitemap are generated at request time from live published rows', async () => {
  const robots = await fetch(`${base}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/publication\.example\/sitemap\.xml/);

  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  assert.match(xml, /https:\/\/publication\.example\/articles\/runtime-database-story\//);
  assert.equal(fs.existsSync(path.join(ROOT, 'sitemap.xml')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'robots.txt')), false);
});

test('Markdown rendering sanitizes scripts and localizes article assets', () => {
  const html = renderMarkdown('## Heading\n\n![Alt](article-images/photo.jpg)\n\n<script>bad()</script>');
  assert.match(html, /id="heading"/);
  assert.match(html, /src="\.\.\/\.\.\/article-images\/photo\.jpg"/);
  assert.doesNotMatch(html, /<script/);
});

test('structured data uses the supplied runtime origin', () => {
  const author = {
    id: 'https://publication.example/about.html#owner',
    name: 'Owner',
    profileUrl: 'https://publication.example/about.html'
  };
  const schema = schemaFor(article,
    'https://publication.example/articles/runtime-database-story/', author,
    'https://publication.example');
  assert.equal(schema['@context'], 'https://schema.org');
  assert.equal(schema['@graph'][0].mainEntityOfPage['@id'],
    'https://publication.example/articles/runtime-database-story/');
});

test('static content exports and generated article directories are absent', () => {
  for (const item of [
    'content-fallback.json', 'articles.json', 'articles', 'generated-images',
    'cms/build-site.js', 'cms/export-fallback.js', 'article-static.js', 'articles.js'
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, item)), false, `${item} should not exist`);
  }
});
