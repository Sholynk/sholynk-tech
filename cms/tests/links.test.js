'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');
const { renderArticlePage } = require('../lib/article-page');

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
  return [];
}

async function runtimePage() {
  const article = {
    slug: 'live-route', title: 'Live route', category: 'Technology',
    description: 'Rendered from SQLite.', body: '## One\n\nText.\n\n## Two\n\nText.\n\n## Three\n\nText.',
    img: 'Images and Assets/page_logo.png', alt: 'Logo', author: 'Owner',
    authorSlug: 'owner', date: '2026-01-01', readingTime: '2 min read',
    status: 'published', tags: [], sources: [], faqs: [], keyTakeaways: [], relatedSlugs: []
  };
  return renderArticlePage({
    article,
    articles: [article],
    authors: [{ slug: 'owner', name: 'Owner', profileUrl: 'about.html' }],
    origin: 'https://example.com'
  });
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

test('deployment contract is expressed with provider-neutral Node and container files', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.start, 'node cms/server.js');
  assert.match(packageJson.engines.node, />=22\.5\.0/);
  assert.ok(fs.existsSync(path.join(ROOT, 'Dockerfile')));
  assert.ok(fs.existsSync(path.join(ROOT, '.env.example')));
});

test('a production database path also makes notification state durable', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sholynk-storage-map-'));
  const database = path.join(tmp, 'cms.sqlite');
  const script = [
    "const { DB_FILE, DATA_DIR } = require('./cms/lib/db');",
    "process.stdout.write(JSON.stringify({ DB_FILE, DATA_DIR }));"
  ].join('');
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    env: { ...process.env, CMS_DB_FILE: database, CMS_DATA_DIR: '' },
    encoding: 'utf8'
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  const paths = JSON.parse(result.stdout);
  assert.equal(paths.DB_FILE, database);
  assert.equal(paths.DATA_DIR, tmp);
});

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

test('runtime clients contain no static content source', () => {
  const client = fs.readFileSync(path.join(ROOT, 'cms-client.js'), 'utf8');
  const engagement = fs.readFileSync(path.join(ROOT, 'engagement.js'), 'utf8');
  assert.doesNotMatch(client, /content-fallback|articles\.json/);
  assert.doesNotMatch(engagement, /comment-queue|REACTION_KEY|COMMENTS_KEY|flushQueue/);
  assert.equal(fs.existsSync(path.join(ROOT, 'content-fallback.json')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'articles.json')), false);
});

test('shared scripts preserve root navigation from a runtime article response', async () => {
  const dom = new JSDOM(await runtimePage(), {
    url: 'https://example.com/articles/live-route/',
    runScripts: 'outside-only'
  });

  dom.window.requestAnimationFrame = (callback) => callback();
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8'));
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'cookie-consent.js'), 'utf8'));
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));

  const expectedPaths = new Set([
    '/index.html', '/about.html', '/contact.html',
    '/help_&_support.html', '/privacy_policy.html'
  ]);
  for (const link of dom.window.document.querySelectorAll('header nav a, .sidebar a, footer a')) {
    if (/^https?:\/\//i.test(link.getAttribute('href'))) continue;
    const target = new URL(link.getAttribute('href'), dom.window.location.href);
    assert.ok(expectedPaths.has(decodeURIComponent(target.pathname)),
      `${link.textContent.trim() || link.getAttribute('aria-label')} resolved to ${target.pathname}`);
  }

  const cookiePrivacy = dom.window.document.querySelector('.cookie-banner a');
  assert.equal(new URL(cookiePrivacy.href).pathname, '/privacy_policy.html');
  dom.window.close();
});

test('CMS client reports API failure without requesting a checked-in snapshot', async () => {
  const dom = new JSDOM('<!doctype html><script src="../../cms-client.js"></script>', {
    url: 'https://example.com/articles/live-route/',
    runScripts: 'outside-only'
  });
  const requests = [];
  dom.window.fetch = async (url) => {
    requests.push(String(url));
    return { ok: false, headers: { get: () => 'application/json' }, json: async () => ({}) };
  };
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'cms-client.js'), 'utf8'));
  await assert.rejects(() => dom.window.SholynkCMS.getSettings(), /content service is unavailable/i);
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0]).pathname, '/health');
  assert.equal(requests.some((url) => /content-fallback|articles\.json/.test(url)), false);
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
