'use strict';

/**
 * Front-end regression tests.
 *
 * These run the real pages through jsdom with the real stylesheet applied, so
 * they catch the class of bug that motivated this work: a CSS rule quietly
 * winning the cascade and making text unreadable.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const CSS = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');

const PAGES = [
  'index.html',
  'article.html',
  'about.html',
  'contact.html',
  'help_&_support.html',
  'privacy_policy.html'
];

function load(file, url = 'https://example.com/') {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // runScripts is intentionally off: these assertions are about markup and CSS,
  // not behaviour, and the pages fetch from the network on load.
  return new JSDOM(html, { url });
}

function runPageScript(file, scriptFile, url = 'https://example.com/') {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const script = fs.readFileSync(path.join(ROOT, scriptFile), 'utf8');
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  return dom;
}

/** Applies styles.css to a document so getComputedStyle reflects real cascade. */
function withStyles(dom) {
  const style = dom.window.document.createElement('style');
  style.textContent = CSS;
  dom.window.document.head.append(style);
  return dom;
}

/* --------------------------- Tailwind removal ----------------------------- */

test('no page loads Tailwind any more', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(
      !html.includes('cdn.tailwindcss.com'),
      `${page} still references the Tailwind CDN`
    );
  }
});

test('no Tailwind utility classes remain in the markup', () => {
  // Patterns that only Tailwind would have produced.
  const utility = new RegExp(
    [
      '^(bg|text|border|from|to|via)-\\[#',           // arbitrary colours
      '^(px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m)-\\d',
      '^(w|h|min-h|max-w)-(\\d|full|screen|auto|xs|sm|md|lg|xl)',
      '^(space|gap)-[xy]?-?\\d',
      '^(text|font)-(xs|sm|base|lg|xl|\\dxl|bold|semibold|extrabold)$',
      '^(sm|md|lg|xl):',                               // responsive prefixes
      '^hover:',
      '^(flex|grid)-(col|row|cols)',
      '^(items|justify)-(center|between|start|end)$',
      '^grid-cols-\\d'
    ].join('|')
  );

  for (const page of PAGES) {
    const dom = load(page);
    const offenders = new Set();
    dom.window.document.querySelectorAll('[class]').forEach((node) => {
      node.classList.forEach((name) => {
        if (utility.test(name)) offenders.add(name);
      });
    });
    assert.deepEqual(
      [...offenders],
      [],
      `${page} still uses Tailwind utility classes: ${[...offenders].join(', ')}`
    );
  }
});

test('every page links the shared stylesheet exactly once and has no inline <style>', () => {
  for (const page of PAGES) {
    const dom = load(page);
    const { document } = dom.window;
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].filter((link) =>
      (link.getAttribute('href') || '').endsWith('styles.css')
    );
    assert.equal(sheets.length, 1, `${page} should link styles.css once`);
    assert.equal(
      document.querySelectorAll('style').length,
      0,
      `${page} should not carry an inline <style> block`
    );
  }
});

/* ----------------------- Hero headline contrast --------------------------- */

test('the hero H1 renders white, not the dark interior-page colour', () => {
  const dom = withStyles(load('index.html'));
  const { document, getComputedStyle } = dom.window;

  // Rebuild the slide the way index.js does at runtime.
  const hero = document.querySelector('.hero-section');
  const slide = document.createElement('section');
  slide.className = 'hero-slide active';
  const content = document.createElement('div');
  content.className = 'hero-content';
  const h1 = document.createElement('h1');
  h1.textContent = 'A featured story headline';
  content.append(h1);
  slide.append(content);
  hero.append(slide);

  const colour = getComputedStyle(h1).color;

  assert.equal(colour, 'rgb(255, 255, 255)', 'hero headline must be white');
  assert.notEqual(
    colour,
    'rgb(15, 23, 42)',
    'hero headline must not inherit the dark --brand-950 interior-page colour'
  );
});

test('the hero headline carries a text-shadow for legibility over bright photos', () => {
  const dom = withStyles(load('index.html'));
  const { document } = dom.window;

  const rule = [...document.styleSheets[0].cssRules].find(
    (item) => item.selectorText === '.hero-content h1'
  );

  assert.ok(rule, '.hero-content h1 rule should exist');
  // cssRules reports the authored value, so compare case-insensitively against
  // either notation for white.
  assert.match(rule.style.color.toLowerCase(), /^(#fff|#ffffff|white|rgb\(255, 255, 255\))$/);
  // jsdom does not expose text-shadow as a typed property, so read the
  // declaration text.
  assert.match(
    rule.style.cssText,
    /text-shadow:\s*[^;]+/i,
    'hero headline should have a text-shadow so it stays readable on light slides'
  );
});

test('no generic section rule can recolour the hero headline', () => {
  // The original bug: `main > section h1 { color: var(--brand-950) }` matched
  // the hero slide, because a slide is a <section> inside <main>.
  const dom = withStyles(load('index.html'));
  const { document } = dom.window;

  const offenders = [...document.styleSheets[0].cssRules]
    .filter((rule) => rule.selectorText)
    .filter((rule) => /^(body|main)\s*>\s*section\s+h1/.test(rule.selectorText));

  assert.deepEqual(
    offenders.map((rule) => rule.selectorText),
    [],
    'generic "main > section h1" rules must not exist — they leak into hero slides'
  );
});

test('category pages use dedicated hero slides instead of the homepage slideshow', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://example.com/index.html?category=AI%20Trends',
    runScripts: 'outside-only'
  });

  dom.window.SholynkCMS = {
    getArticles: async (params = {}) => {
      if (params.hero) {
        return [
          {
            title: 'Mastering the art of coding',
            category: 'Technology',
            description: 'Homepage-only story.',
            img: 'coding.jpg',
            alt: 'Coding',
            link: 'article.html?slug=mastering-the-art-of-coding'
          }
        ];
      }
      return [
        {
          title: 'Existing AI card',
          category: 'AI Trends',
          description: 'A category card.',
          date: '2026-07-30',
          readingTime: '1 min read',
          link: 'index.html?category=AI%20Trends'
        },
        {
          title: 'Existing technology card',
          category: 'Technology',
          description: 'A technology card.',
          date: '2026-07-30',
          readingTime: '1 min read',
          link: 'index.html?category=Technology'
        }
      ];
    },
    getSettings: async () => ({})
  };

  const script = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  const titles = [...dom.window.document.querySelectorAll('.hero-slide h1')].map((node) => node.textContent);
  assert.ok(titles.includes('How Artificial Intelligence Is Reshaping Every Industry'));
  assert.ok(!titles.includes('Mastering the art of coding'));

  dom.window.close();
});

/* --------------------- Navbar and footer: solid colours -------------------- */

test('the navbar and footer use solid backgrounds, not gradients', () => {
  // Assert on the authored rules: jsdom's getComputedStyle does not resolve
  // var() references, so it would report an empty background for both.
  const dom = withStyles(load('index.html'));
  const rules = [...dom.window.document.styleSheets[0].cssRules].filter((r) => r.selectorText);

  for (const selector of ['.site-header', '.site-footer', '.footer-legal']) {
    const rule = rules.find((item) => item.selectorText === selector);
    assert.ok(rule, `${selector} rule should exist`);

    const declaration = `${rule.style.background} ${rule.style.backgroundImage}`;
    assert.ok(
      !/gradient/i.test(declaration),
      `${selector} should use a solid colour, not a gradient (found: ${declaration.trim()})`
    );
    assert.match(
      rule.style.background || rule.style.backgroundColor,
      /var\(--(header|footer)/,
      `${selector} should pull its solid colour from a token`
    );
  }

  // The tokens themselves must be solid colours.
  const root = rules.find((item) => item.selectorText === ':root');
  for (const token of ['--header-bg', '--footer-bg', '--footer-legal-bg']) {
    const value = root.style.getPropertyValue(token).trim();
    assert.match(value, /^#[0-9a-f]{6}$/i, `${token} should be a solid hex colour, got "${value}"`);
  }
});

test('every page uses the shared solid-background header and footer', () => {
  for (const page of PAGES) {
    const dom = load(page);
    const { document } = dom.window;
    assert.ok(document.querySelector('header.site-header'), `${page} should use .site-header`);
    assert.ok(document.querySelector('footer.site-footer'), `${page} should use .site-footer`);
  }
});

test('category navigation highlights only the selected desktop and sidebar tab', () => {
  const dom = runPageScript(
    'index.html',
    'script.js',
    'https://example.com/index.html?category=AI%20Trends'
  );
  const { document } = dom.window;

  const activeDesktop = [...document.querySelectorAll('.site-nav a.is-active')].map((link) => link.textContent.trim());
  const activeSidebar = [...document.querySelectorAll('.sidebar li.highlighted a')].map((link) => link.textContent.trim());

  assert.deepEqual(activeDesktop, ['AI']);
  assert.deepEqual(activeSidebar, ['AI']);
  assert.equal(document.querySelector('.site-nav a[href="index.html"]')?.classList.contains('is-active'), false);

  dom.window.close();
});

test('other components keep their gradients', () => {
  const dom = withStyles(load('index.html'));
  const rules = [...dom.window.document.styleSheets[0].cssRules].filter((r) => r.selectorText);

  const stillGradient = ['.category-label', '.hero-slide::before', '.reading-progress span'];
  for (const selector of stillGradient) {
    const rule = rules.find((item) => item.selectorText === selector);
    assert.ok(rule, `${selector} should exist`);
    const declaration = rule.style.background || rule.style.backgroundImage || '';
    assert.ok(
      /gradient/i.test(declaration),
      `${selector} should still use a gradient (only the navbar and footer changed)`
    );
  }
});

/* ------------------------ Engagement widget markup ------------------------- */

test('article page loads the engagement script', () => {
  for (const page of ['article.html']) {
    const dom = load(page);
    const scripts = [...dom.window.document.querySelectorAll('script[src]')].map((s) =>
      s.getAttribute('src')
    );
    assert.ok(
      scripts.includes('engagement.js'),
      `${page} should load engagement.js`
    );
  }
});

/* ------------------------- article page rendering ----------------------- */

test('article.html uses the same structural shell as the CMS article page', () => {
  const dom = load('article.html');
  const { document } = dom.window;

  for (const selector of [
    '.reading-progress',
    '#readingProgressBar',
    '.article-page',
    '#articleRoot',
    '#articleStatus',
    '.site-header',
    '.site-footer'
  ]) {
    assert.ok(document.querySelector(selector), `article.html is missing ${selector}`);
  }
});

test('article page dynamically renders article structure with TOC, hero, and engagement', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'article.html'), 'utf8');
  const fallback = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-fallback.json'), 'utf8'));

  const dom = new JSDOM(html, {
    url: 'https://example.com/article.html?slug=mastering-the-art-of-coding',
    runScripts: 'outside-only'
  });

  dom.window.SholynkCMS = {
    getArticle: async (slug) => fallback.articles.find((a) => a.slug === slug),
    getArticles: async () => fallback.articles
  };

  dom.window.SholynkMarkdown = {
    renderMarkdown: async () =>
      '<h2>Section 1</h2><p>Body text 1</p><h2>Section 2</h2><p>Body text 2</p><h2>Section 3</h2><p>Body text 3</p>'
  };

  const articleScript = fs.readFileSync(path.join(ROOT, 'article.js'), 'utf8');
  dom.window.eval(articleScript);

  await new Promise((resolve) => dom.window.setTimeout(resolve, 50));

  const { document } = dom.window;
  assert.equal(document.querySelectorAll('h1').length, 1, 'exactly one H1');
  assert.equal(document.querySelector('h1').textContent, 'Mastering the art of coding');
  assert.ok(document.querySelector('.article-breadcrumb'), 'breadcrumb rendered');
  assert.ok(document.querySelector('.article-header'), 'header rendered');
  assert.ok(document.querySelector('.article-hero img'), 'hero image rendered');
  assert.ok(document.querySelector('.article-toc'), 'table of contents rendered');
  assert.ok(document.querySelector('.article-body'), 'body rendered');
  assert.ok(document.querySelector('.article-share'), 'share row rendered');
  assert.ok(document.querySelector('#engagementRoot'), 'engagement root rendered');
  assert.ok(document.querySelector('.article-back'), 'back button rendered');

  dom.window.close();
});

/* ------------------------------ shared shell ------------------------------- */

test('every page shares the same header, sidebar and footer structure', () => {
  for (const page of PAGES) {
    const dom = load(page);
    const { document } = dom.window;

    assert.ok(document.querySelector('.site-header .site-nav'), `${page} needs the primary nav`);
    assert.ok(document.querySelector('#sidebar'), `${page} needs the mobile sidebar`);
    assert.ok(document.querySelector('.hamburger'), `${page} needs the menu button`);
    assert.ok(document.querySelector('.site-footer .footer-links'), `${page} needs footer links`);
    assert.ok(document.getElementById('copyrightYear'), `${page} needs the copyright year slot`);
  }
});

test('all images across the site have an alt attribute', () => {
  for (const page of PAGES) {
    const dom = load(page);
    dom.window.document.querySelectorAll('img').forEach((image) => {
      assert.ok(
        image.hasAttribute('alt'),
        `${page}: <img src="${image.getAttribute('src')}"> is missing alt`
      );
    });
  }
});

/* ----------------------- bento mosaic grid ------------------------ */

test('index.html wraps the article/image cards in .bento-feed container', () => {
  const dom = load('index.html');
  const container = dom.window.document.querySelector('.bento-feed');
  assert.ok(container, 'index.html should contain .bento-feed container');
  assert.equal(container.id, 'cardsContainer', '.bento-feed should wrap the cardsContainer');
});

test('.bento-feed is styled with CSS Grid, auto-rows 20px, dense packing, and 12px gap', () => {
  assert.ok(/\.bento-feed\s*\{[^}]*display:\s*grid/.test(CSS), '.bento-feed should use display: grid');
  assert.ok(/\.bento-feed\s*\{[^}]*grid-auto-flow:\s*dense/.test(CSS), '.bento-feed should use dense packing');
  assert.ok(/\.bento-feed\s*\{[^}]*grid-auto-rows:\s*20px/.test(CSS), '.bento-feed should use 20px auto-rows');
  assert.ok(/\.bento-feed\s*\{[^}]*gap:\s*12px/.test(CSS), '.bento-feed should use 12px gap');
});

test('all bento tile shapes follow the shared-unit row-span and divisor column-span rules', () => {
  assert.ok(/\.bento-feed\s+\.card--tall\s*\{[^}]*grid-row:\s*span\s+24/.test(CSS), 'tall tile should span 24 rows');
  assert.ok(/\.bento-feed\s+\.card--square[^}]*grid-row:\s*span\s+12/.test(CSS), 'square tile should span 12 rows');
  assert.ok(/\.bento-feed\s+\.card--landscape[^}]*grid-row:\s*span\s+12/.test(CSS), 'landscape tile should span 12 rows');
  assert.ok(/\.bento-feed\s+\.card--wide[^}]*grid-row:\s*span\s+12/.test(CSS), 'wide tile should span 12 rows');
});

test('panoramic wide shape spans 4 columns while keeping 12-track row span', () => {
  assert.ok(/\.bento-feed\s+\.card--wide\s*\{[^}]*grid-column:\s*span\s+4[^}]*grid-row:\s*span\s+12/.test(CSS), 'wide shape should be wider (span 4) with same 12 row span');
});

test('bento-feed images use object-fit: cover without distortion', () => {
  assert.ok(/\.bento-feed\s+\.card-media\s+img\s*\{[^}]*object-fit:\s*cover/.test(CSS), 'images should use object-fit: cover');
});

test('createCard assigns tile shapes dynamically by aspect ratio rather than index/cycle alone', () => {
  const js = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');
  assert.ok(/function\s+classifyAspectRatio/.test(js), 'index.js should define classifyAspectRatio');
  assert.ok(!/tilePatterns/.test(js), 'index.js should no longer use tilePatterns index/cycle');
  assert.ok(!/card--col-/.test(js), 'index.js should not assign legacy card--col- classes');
  assert.ok(!/card--rows-/.test(js), 'index.js should not assign legacy card--rows- classes');
  assert.ok(!/\.card--col-1/.test(CSS), 'styles.css should not define legacy card--col- classes');
});
