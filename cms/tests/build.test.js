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

test('generated long-form pages use the rebuilt responsive reading shell', () => {
  for (const article of fullArticles) {
    const document = new JSDOM(fs.readFileSync(pageFor(article.slug), 'utf8')).window.document;
    const layout = document.querySelector('.article-reading-layout');
    const toc = document.querySelector('details.article-toc');

    assert.ok(document.body.classList.contains('article-view'), `${article.slug}: article body scope missing`);
    assert.ok(document.querySelector('.article-masthead'), `${article.slug}: masthead missing`);
    assert.ok(document.querySelector('.article-hero-media img[srcset]'), `${article.slug}: responsive hero missing`);
    assert.ok(layout, `${article.slug}: reading layout missing`);
    assert.ok(layout.querySelector('.article-rail'), `${article.slug}: navigation rail missing`);
    assert.ok(layout.querySelector('.article-content .article-body'), `${article.slug}: content column missing`);
    assert.ok(toc?.querySelector('summary'), `${article.slug}: compact TOC disclosure missing`);
    assert.ok(document.querySelector('[data-copy-article]'), `${article.slug}: copy-link action missing`);

    for (const link of toc.querySelectorAll('a[href^="#"]')) {
      const targetId = decodeURIComponent(link.getAttribute('href').slice(1));
      assert.ok(document.getElementById(targetId), `${article.slug}: broken TOC target #${targetId}`);
    }
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

test('every local image on generated pages declares intrinsic width and height', () => {
  // Images without dimensions occupy zero height until they decode, so the
  // page reflows as each one lands and in-page anchors drift away from the
  // heading they targeted. Declaring the real size keeps the layout stable.
  for (const article of fullArticles) {
    const dom = new JSDOM(fs.readFileSync(pageFor(article.slug), 'utf8'));
    const images = [...dom.window.document.querySelectorAll('img')];
    assert.ok(images.length > 0, `${article.slug} should render images`);

    for (const image of images) {
      const src = image.getAttribute('src') || '';
      if (/^(?:https?:|data:|\/\/)/i.test(src)) continue;

      const width = Number(image.getAttribute('width'));
      const height = Number(image.getAttribute('height'));
      assert.ok(
        Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0,
        `${article.slug}: <img src="${src}"> is missing intrinsic dimensions`
      );

      // The declared ratio must match the file on disk, otherwise the reserved
      // box is the wrong shape and the page still shifts once the image loads.
      const file = path.resolve(ROOT, decodeURIComponent(src.replace(/^(?:\.\.\/)+/, '')));
      assert.ok(fs.existsSync(file), `${article.slug}: ${src} does not exist on disk`);
    }
    dom.window.close();
  }
});

test('related-story links resolve at a domain root and under a deployment sub-path', () => {
  for (const article of fullArticles) {
    const document = new JSDOM(fs.readFileSync(pageFor(article.slug), 'utf8')).window.document;
    for (const link of document.querySelectorAll('.related-card[href]')) {
      const href = link.getAttribute('href');
      // Relative to the page's own directory, so the link survives being served
      // from a sub-path (GitHub Pages project sites) as well as a domain root.
      assert.match(href, /^\.\.\/\.\.\/articles\/[a-z0-9-]+\/$/);

      const atRoot = new URL(href, `https://example.com/articles/${article.slug}/`).pathname;
      assert.match(atRoot, /^\/articles\/[a-z0-9-]+\/$/);

      const underSubPath = new URL(href, `https://example.com/repo/articles/${article.slug}/`).pathname;
      assert.match(underSubPath, /^\/repo\/articles\/[a-z0-9-]+\/$/);
    }
  }
});

test('Markdown links on generated article pages resolve from the site root at any deployment prefix', () => {
  const { renderMarkdown } = require('../build-site');
  const html = renderMarkdown(`
[About](about.html?from=article#oluwashola-busari)
[Another story](articles/another-story/)
[This section](#details)
[Current view](?view=compact)
[Root path](/contact.html)
[External](https://example.org/report)
[Email](mailto:editor@example.org)
  `);
  const document = new JSDOM(html, {
    url: 'https://example.com/articles/current-story/'
  }).window.document;
  const links = Object.fromEntries(
    [...document.querySelectorAll('a')].map((link) => [link.textContent, link])
  );

  assert.equal(links.About.getAttribute('href'), '../../about.html?from=article#oluwashola-busari');
  assert.equal(links.About.href, 'https://example.com/about.html?from=article#oluwashola-busari');
  assert.equal(links['Another story'].href, 'https://example.com/articles/another-story/');
  assert.equal(links['This section'].getAttribute('href'), '#details');
  assert.equal(links['Current view'].getAttribute('href'), '?view=compact');
  // Author-written root-relative links are rewritten too: on a sub-path
  // deployment a bare "/contact.html" would leave the site and 404.
  assert.equal(links['Root path'].getAttribute('href'), '../../contact.html');
  assert.equal(links['Root path'].href, 'https://example.com/contact.html');
  assert.equal(links.External.target, '_blank');
  assert.equal(links.External.rel, 'noopener noreferrer');
  assert.equal(links.Email.getAttribute('href'), 'mailto:editor@example.org');

  // The same markup must also stay inside a sub-path deployment, which is where
  // root-relative hrefs previously escaped to the domain root and 404'd.
  const subPath = new JSDOM(html, {
    url: 'https://example.com/repo/articles/current-story/'
  }).window.document;
  const subLinks = Object.fromEntries(
    [...subPath.querySelectorAll('a')].map((link) => [link.textContent, link])
  );
  assert.equal(subLinks.About.href, 'https://example.com/repo/about.html?from=article#oluwashola-busari');
  assert.equal(subLinks['Another story'].href, 'https://example.com/repo/articles/another-story/');
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
