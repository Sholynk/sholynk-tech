'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const ROOT_PAGES = [
  'index.html',
  'article.html',
  'about.html',
  'contact.html',
  'help_&_support.html',
  'privacy_policy.html'
];

function generatedPages() {
  const articlesDir = path.join(ROOT, 'articles');
  if (!fs.existsSync(articlesDir)) return [];
  return fs.readdirSync(articlesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join('articles', entry.name, 'index.html'))
    .filter((file) => fs.existsSync(path.join(ROOT, file)));
}

function pageUrl(file) {
  return new URL(file.split(path.sep).map(encodeURIComponent).join('/'), 'https://example.com/').href;
}

function localTarget(raw, sourceFile) {
  if (!raw || /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(raw)) return null;
  const url = new URL(raw, pageUrl(sourceFile));
  let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (relative.endsWith('/')) relative += 'index.html';
  let target = path.join(ROOT, relative);
  if (!fs.existsSync(target) && fs.existsSync(`${target}.html`)) target = `${target}.html`;
  return { url, target };
}

function assertLocalReference(raw, sourceFile, document) {
  if (raw.startsWith('#')) {
    const id = decodeURIComponent(raw.slice(1));
    assert.ok(!id || document.getElementById(id), `${sourceFile}: missing fragment ${raw}`);
    return;
  }

  const resolved = localTarget(raw, sourceFile);
  if (!resolved) return;
  assert.ok(
    fs.existsSync(resolved.target),
    `${sourceFile}: ${raw} resolves to missing ${path.relative(ROOT, resolved.target)}`
  );

  if (resolved.url.hash && resolved.target.endsWith('.html')) {
    const targetDocument = new JSDOM(fs.readFileSync(resolved.target, 'utf8')).window.document;
    const id = decodeURIComponent(resolved.url.hash.slice(1));
    assert.ok(targetDocument.getElementById(id), `${sourceFile}: ${raw} has a missing target fragment`);
  }
}

test('all public HTML links, scripts, images and responsive sources resolve locally', () => {
  for (const file of [...ROOT_PAGES, ...generatedPages()]) {
    const document = new JSDOM(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
      url: pageUrl(file)
    }).window.document;

    for (const [selector, attribute] of [
      ['a[href]', 'href'],
      ['link[href]', 'href'],
      ['script[src]', 'src'],
      ['img[src]', 'src'],
      ['source[src]', 'src']
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        assertLocalReference(element.getAttribute(attribute), file, document);
      }
    }

    for (const image of document.querySelectorAll('img[srcset]')) {
      const candidates = image.getAttribute('srcset').split(',').map((candidate) => candidate.trim().split(/\s+/, 1)[0]);
      candidates.forEach((candidate) => assertLocalReference(candidate, file, document));
    }
  }
});

test('content snapshot image paths and full-article links point to real files', () => {
  const fallback = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-fallback.json'), 'utf8'));
  for (const article of fallback.articles) {
    if (article.img && !/^https?:\/\//i.test(article.img)) {
      assert.ok(fs.existsSync(path.join(ROOT, article.img)), `${article.slug}: missing image ${article.img}`);
    }
    if (article.body && !article.externalLink) {
      const generated = path.join(ROOT, 'articles', article.slug, 'index.html');
      assert.ok(fs.existsSync(generated), `${article.slug}: missing generated long-form page`);
      assert.equal(article.link, `articles/${encodeURIComponent(article.slug)}/`);
    }
  }
});

test('shared scripts preserve root navigation from generated article pages', () => {
  const file = generatedPages()[0];
  assert.ok(file, 'at least one generated article page is required');
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    url: pageUrl(file),
    runScripts: 'outside-only'
  });

  dom.window.requestAnimationFrame = (callback) => callback();
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8'));
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'cookie-consent.js'), 'utf8'));
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));

  const expectedPaths = new Set([
    '/index.html',
    '/about.html',
    '/contact.html',
    '/help_&_support.html',
    '/privacy_policy.html'
  ]);
  for (const link of dom.window.document.querySelectorAll('header nav a, .sidebar a, footer a')) {
    const target = new URL(link.getAttribute('href'), dom.window.location.href);
    if (!/^https?:\/\//i.test(link.getAttribute('href'))) {
      assert.ok(
        expectedPaths.has(decodeURIComponent(target.pathname)),
        `${link.textContent.trim() || link.getAttribute('aria-label')} resolves inside the article directory: ${target.pathname}`
      );
    }
  }

  const cookiePrivacy = dom.window.document.querySelector('.cookie-banner a');
  assert.equal(new URL(cookiePrivacy.href).pathname, '/privacy_policy.html');
  assert.equal(
    dom.window.document.querySelectorAll('header nav a[aria-current], .sidebar a[aria-current], footer a[aria-current]').length,
    0
  );
  dom.window.close();
});

test('CMS static fallback resolves from the site root on generated pages', async () => {
  const file = generatedPages()[0];
  assert.ok(file, 'at least one generated article page is required');
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    url: pageUrl(file),
    runScripts: 'outside-only'
  });
  const requests = [];
  dom.window.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes('/api/settings')) {
      return { ok: false, headers: { get: () => 'text/html' } };
    }
    return {
      ok: true,
      json: async () => ({ articles: [], settings: { siteTitle: 'Fallback works' } })
    };
  };

  dom.window.eval(fs.readFileSync(path.join(ROOT, 'cms-client.js'), 'utf8'));
  const settings = await dom.window.SholynkCMS.getSettings();
  assert.equal(settings.siteTitle, 'Fallback works');
  const fallbackRequest = requests.find((url) => url.includes('content-fallback.json'));
  assert.ok(fallbackRequest, 'the fallback snapshot should be requested');
  assert.equal(new URL(fallbackRequest, dom.window.location.href).pathname, '/content-fallback.json');
  dom.window.close();
});

/**
 * Regression guard for sub-path deployments (e.g. GitHub Pages project sites
 * served from https://<user>.github.io/<repo>/).
 *
 * A root-relative reference such as "/styles.css" or "/about.html" is resolved
 * by the browser against the *domain* root, so under a sub-path it escapes the
 * deployment prefix: the stylesheet 404s (pages render unstyled) and in-page
 * links land on "page not found". Every local reference must therefore stay
 * inside the deployment prefix once resolved.
 */
test('every local reference stays inside the deployment prefix on a sub-path host', () => {
  const PREFIX = '/sholynk-tech/';

  function subPathUrl(file) {
    return new URL(
      file.split(path.sep).map(encodeURIComponent).join('/'),
      `https://example.github.io${PREFIX}`
    ).href;
  }

  for (const file of [...ROOT_PAGES, ...generatedPages()]) {
    const pageHref = subPathUrl(file);
    const document = new JSDOM(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
      url: pageHref
    }).window.document;

    const references = [];
    for (const [selector, attribute] of [
      ['a[href]', 'href'],
      ['link[href]', 'href'],
      ['script[src]', 'src'],
      ['img[src]', 'src'],
      ['source[src]', 'src']
    ]) {
      for (const element of document.querySelectorAll(selector)) {
        references.push(element.getAttribute(attribute));
      }
    }
    for (const image of document.querySelectorAll('img[srcset]')) {
      for (const candidate of image.getAttribute('srcset').split(',')) {
        references.push(candidate.trim().split(/\s+/, 1)[0]);
      }
    }

    for (const raw of references) {
      if (!raw || /^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(raw)) continue;
      const resolved = new URL(raw, pageHref);
      assert.ok(
        resolved.pathname.startsWith(PREFIX),
        `${file}: "${raw}" escapes the deployment prefix and resolves to ${resolved.pathname}`
      );

      // It must also point at a file that actually exists in the repository.
      let relative = decodeURIComponent(resolved.pathname.slice(PREFIX.length));
      if (relative.endsWith('/') || relative === '') relative += 'index.html';
      assert.ok(
        fs.existsSync(path.join(ROOT, relative)),
        `${file}: "${raw}" resolves to missing ${relative}`
      );
    }
  }
});
