'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const fallback = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-fallback.json'), 'utf8'));
const fullArticles = fallback.articles.filter((article) => article.status === 'published' && article.body && !article.externalLink);

function pageFor(slug) {
  return path.join(ROOT, 'articles', slug, 'index.html');
}

test('only genuine body-bearing articles receive generated clean-path pages', () => {
  assert.ok(fullArticles.length > 0);
  const generated = fs.readdirSync(path.join(ROOT, 'articles'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(generated, fullArticles.map((article) => article.slug).sort());

  const emptyExternal = fallback.articles.find((article) => !article.body && article.externalLink);
  assert.ok(emptyExternal, 'the seed should retain card-only external records');
  assert.equal(fs.existsSync(pageFor(emptyExternal.slug)), false);
});

test('generated pages contain full initial HTML, canonical metadata and structured data', () => {
  for (const article of fullArticles) {
    const html = fs.readFileSync(pageFor(article.slug), 'utf8');
    const document = new JSDOM(html).window.document;
    assert.equal(document.querySelector('h1')?.textContent, article.title);
    assert.ok(document.querySelector('.article-body')?.textContent.trim().split(/\s+/).length > 300);
    assert.equal(document.querySelector('#articleRoot')?.dataset.prerendered, 'true');
    assert.equal(
      document.querySelector('link[rel="canonical"]')?.href,
      `https://sholynktech.netlify.app/articles/${article.slug}/`
    );
    assert.ok(document.querySelector('meta[property="og:url"]'));
    assert.ok(document.querySelector('meta[name="twitter:card"]'));
    assert.ok(document.querySelector('.article-hero img[srcset]'));

    const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
    const types = schema['@graph'].map((entry) => entry['@type']);
    assert.ok(types.includes('Article'));
    assert.ok(types.includes('BreadcrumbList'));
    assert.equal(types.includes('FAQPage'), Boolean(article.faqs?.length));
    const articleSchema = schema['@graph'].find((entry) => entry['@type'] === 'Article');
    const author = fallback.authors.find((item) => item.slug === article.authorSlug);
    assert.ok(author, `missing author entity for ${article.slug}`);
    const expectedAuthorId = author.profileUrl.includes('#')
      ? author.profileUrl
      : `${author.profileUrl}#${author.slug}`;
    assert.equal(articleSchema.author['@id'], expectedAuthorId);
    assert.equal(articleSchema.author.jobTitle, author.role);
    assert.ok(document.querySelector('.article-meta a')?.href);
  }
});

test('responsive derivatives preserve originals and use valid local files', () => {
  for (const article of fullArticles) {
    assert.ok(fs.existsSync(path.join(ROOT, article.img)), `original missing for ${article.slug}`);
    const outputDir = path.join(ROOT, 'generated-images', article.slug);
    const variants = fs.readdirSync(outputDir).filter((file) => file.endsWith('.webp'));
    assert.ok(variants.length >= 2, `${article.slug} needs at least two responsive variants`);
    variants.forEach((variant) => assert.ok(fs.statSync(path.join(outputDir, variant)).size > 0));
  }
});

test('sitemap lists canonical article URLs and robots advertises the sitemap', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  for (const article of fullArticles) {
    assert.match(sitemap, new RegExp(`https://sholynktech\\.netlify\\.app/articles/${article.slug}/`));
  }
  assert.match(robots, /Sitemap: https:\/\/sholynktech\.netlify\.app\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin\//);
});
