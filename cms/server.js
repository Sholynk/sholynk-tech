'use strict';

const path = require('node:path');
const express = require('express');

const apiRouter = require('./routes/api');
const { UPLOAD_DIR } = require('./lib/images');

const ROOT = path.join(__dirname, '..');
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api', apiRouter);

// Uploaded media.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// Admin UI.
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// The existing static site (index.html, generated articles, styles.css, ...).
app.use(express.static(ROOT, { extensions: ['html'] }));

// A CMS article can exist before the next static generation run. Keep its
// clean link usable on the Node server by falling back to the legacy renderer;
// generated files are served by express.static above and never reach here.
app.get('/articles/:slug', (req, res) => {
  res.redirect(302, `/article.html?slug=${encodeURIComponent(req.params.slug)}`);
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  return res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  if (!['0', 'false', 'no'].includes(String(process.env.CMS_AUTO_SEED || '').toLowerCase())) {
    require('./seed').ensureSeeded();
  }

  app.listen(PORT, () => {
    console.log(`Sholynk CMS running:  http://localhost:${PORT}`);
    console.log(`Admin dashboard:      http://localhost:${PORT}/admin/`);
    console.log(`Articles API:         http://localhost:${PORT}/api/articles`);
  });
}

module.exports = app;
