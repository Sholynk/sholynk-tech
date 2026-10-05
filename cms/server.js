'use strict';

const express = require('express');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const apiRouter = require('./routes/api');
const { db } = require('./lib/db');
const articles = require('./lib/articles');
const authors = require('./lib/authors');
const settings = require('./lib/settings');
const { UPLOAD_DIR } = require('./lib/images');
const { renderArticlePage, escapeHtml } = require('./lib/article-page');

const app = express();
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SITE_URL = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');

if (SITE_URL && !/^https?:\/\/[^/]+/i.test(SITE_URL)) {
  throw new Error('SITE_URL must be an absolute HTTP(S) origin, for example https://example.com');
}

if (process.env.TRUST_PROXY) {
  const trustProxy = /^\d+$/.test(process.env.TRUST_PROXY)
    ? Number(process.env.TRUST_PROXY)
    : process.env.TRUST_PROXY;
  app.set('trust proxy', trustProxy);
}

function publicOrigin(req) {
  if (SITE_URL) return new URL(SITE_URL).origin;
  return new URL(`${req.protocol}://${req.get('host')}`).origin;
}

function liveArticle(slug) {
  const article = articles.getBySlug(slug);
  return article?.status === 'published' ? article : null;
}

function articleDestination(req, article) {
  const link = String(article.externalLink || '').trim();
  if (/^https?:\/\//i.test(link)) return link;
  return new URL(link.replace(/^\/+/, ''), `${publicOrigin(req)}/`).href;
}

function replaceMeta(html, attribute, key, content) {
  const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${safeKey}")[^>]*>`, 'i');
  return html.replace(pattern, `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`);
}

/**
 * Canonical and social URLs must describe the origin the request actually
 * arrived on, not the checked-in placeholder. Presentation pages ship relative
 * values so they keep working from any directory; this rewrites them to the
 * live origin exactly as the article renderer and sitemap already do.
 */
function applyOriginMetadata(html, canonical) {
  let output = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );
  output = output.replace(
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`
  );
  output = output.replace(
    /<meta\s+property="og:image"\s+content="([^"]*)"/i,
    (match, value) => {
      let absolute = value;
      try {
        absolute = new URL(value, canonical).href;
      } catch (error) {
        absolute = value;
      }
      return `<meta property="og:image" content="${escapeHtml(absolute)}" />`;
    }
  );
  return output;
}

/**
 * Static presentation pages carry fixed marketing copy, so unlike the homepage
 * they are not read from SQLite. They are still served through Express so their
 * canonical metadata matches the deployment that is serving them.
 */
function renderPresentationPage(req, file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (!file.endsWith('.html')) return html;
  const canonical = file === 'index.html' ? `${publicOrigin(req)}/` : `${publicOrigin(req)}/${file}`;
  return applyOriginMetadata(html, canonical);
}

function renderHomepage(req) {
  const current = settings.all();
  const origin = publicOrigin(req);
  const canonical = new URL('/', `${origin}/`).href;
  const image = new URL('/Images%20and%20Assets/page_logo.png', `${origin}/`).href;
  const title = current.siteTitle || 'Sholynk Technology';
  const description = current.siteDescription || '';
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${canonical}#organization`,
        name: 'Sholynk Technology',
        url: canonical,
        logo: image,
        founder: { '@id': new URL('/about.html#oluwashola-busari', `${origin}/`).href }
      },
      {
        '@type': 'WebSite',
        '@id': `${canonical}#website`,
        url: canonical,
        name: title,
        description,
        publisher: { '@id': `${canonical}#organization` }
      }
    ]
  };

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceMeta(html, 'name', 'keywords', current.siteKeywords || '');
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = applyOriginMetadata(html, canonical);
  html = html.replace(
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`
  );
  if (current.homeTagline) {
    html = html.replace(
      /(<h2\s+id="discover-title">)[\s\S]*?(<\/h2>)/i,
      `$1${escapeHtml(current.homeTagline)}$2`
    );
  }
  return html;
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use('/api', apiRouter);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get(['/health', '/healthz'], (req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) AS count FROM articles').get();
    res.json({ ok: true, database: true, articles: row.count });
  } catch (error) {
    res.status(503).json({ ok: false, database: false });
  }
});

app.get('/robots.txt', (req, res) => {
  const origin = publicOrigin(req);
  res.type('text/plain').set('Cache-Control', 'public, max-age=300').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    `Sitemap: ${new URL('/sitemap.xml', `${origin}/`).href}`,
    ''
  ].join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
  const origin = publicOrigin(req);
  const staticPages = [
    { path: '/', priority: '1.0', frequency: 'daily' },
    { path: '/about.html', priority: '0.7', frequency: 'monthly' },
    { path: '/contact.html', priority: '0.6', frequency: 'monthly' },
    { path: '/help_&_support.html', priority: '0.5', frequency: 'monthly' },
    { path: '/privacy_policy.html', priority: '0.4', frequency: 'yearly' }
  ];
  const urls = staticPages.map((page) => ({
    loc: new URL(page.path, `${origin}/`).href,
    ...page
  }));

  for (const article of articles.list({ status: 'published' })) {
    if (!article.body || article.externalLink) continue;
    const changed = article.updatedAt || article.date;
    const lastmod = changed && !Number.isNaN(new Date(changed).valueOf())
      ? new Date(changed).toISOString().slice(0, 10)
      : article.date;
    urls.push({
      loc: article.canonicalUrl || new URL(`/articles/${encodeURIComponent(article.slug)}/`, `${origin}/`).href,
      lastmod,
      frequency: 'monthly',
      priority: article.featured ? '0.9' : '0.8'
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url>\n    <loc>${escapeHtml(url.loc)}</loc>${url.lastmod ? `\n    <lastmod>${escapeHtml(url.lastmod)}</lastmod>` : ''}\n    <changefreq>${url.frequency}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(xml);
});

// Keep old shared links working, but make the clean route canonical.
app.get('/article.html', (req, res) => {
  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.redirect(302, '/');
  const article = liveArticle(slug);
  if (!article) return res.status(404).type('text/plain').send('Article not found');
  if (article.externalLink) return res.redirect(302, articleDestination(req, article));
  return res.redirect(301, `/articles/${encodeURIComponent(article.slug)}/`);
});

// Clean article responses are rendered from current SQLite rows on every request.
app.get(['/articles/:slug', '/articles/:slug/'], async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '');
    let article = liveArticle(slug);
    if (!article) {
      const redirect = db
        .prepare('SELECT new_slug FROM redirects WHERE old_slug = ?')
        .get(slug);
      if (redirect) return res.redirect(301, `/articles/${encodeURIComponent(redirect.new_slug)}/`);
      return res.status(404).type('text/plain').send('Article not found');
    }
    if (article.externalLink) return res.redirect(302, articleDestination(req, article));
    if (!article.body) return res.status(404).type('text/plain').send('Article not found');

    const html = await renderArticlePage({
      article,
      articles: articles.list({ status: 'published' }),
      authors: authors.list(),
      origin: publicOrigin(req)
    });
    if (!html) return res.status(404).type('text/plain').send('Article not found');
    return res.type('html').set('Cache-Control', 'no-cache').send(html);
  } catch (error) {
    return next(error);
  }
});

// Presentation assets are static; all mutable content and user data come from
// the routes above or from /api. Serve an explicit allowlist so repository
// source, seed material, secrets and documentation can never become web files.
const assetCache = process.env.NODE_ENV === 'production' ? '1h' : 0;
for (const directory of ['Images and Assets', 'Article cards images', 'article-images']) {
  app.use(`/${directory}`, express.static(path.join(ROOT, directory), {
    maxAge: assetCache,
    fallthrough: false
  }));
}

const publicFiles = new Set([
  'index.html', 'about.html', 'contact.html', 'help_&_support.html', 'privacy_policy.html',
  'article.js', 'cms-client.js', 'cookie-consent.js', 'engagement.js', 'index.js', 'script.js',
  'styles.css'
]);
app.get(['/', '/index.html'], (req, res) => {
  res.type('html').set('Cache-Control', 'no-cache').send(renderHomepage(req));
});
app.get('/:file', (req, res, next) => {
  let file = String(req.params.file || '');
  if (!file.includes('.') && publicFiles.has(`${file}.html`)) file = `${file}.html`;
  if (!publicFiles.has(file)) return next();
  if (file.endsWith('.html')) {
    return res.type('html').set('Cache-Control', 'no-cache').send(renderPresentationPage(req, file));
  }
  return res.sendFile(path.join(ROOT, file));
});

app.use((req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Sholynk CMS running on http://${HOST}:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}; shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
module.exports.publicOrigin = publicOrigin;
