'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const articles = require('../lib/articles');
const images = require('../lib/images');
const settings = require('../lib/settings');
const engagement = require('../lib/engagement');
const authors = require('../lib/authors');

const router = express.Router();

/* ------------------------------- uploads -------------------------------- */

const IMAGE_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif']
]);
const ALLOWED_MIME = new Set(IMAGE_EXTENSIONS.keys());
const IMAGE_FORMATS = new Map([
  ['image/jpeg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'heif']
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, images.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = IMAGE_EXTENSIONS.get(file.mimetype) || '.img';
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'image';
    cb(null, `${base}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const error = new Error('Unsupported image type. Use JPEG, PNG, WebP, GIF or AVIF.');
      error.status = 400;
      cb(error);
      return;
    }
    cb(null, true);
  }
});

/* ------------------------------- auth ----------------------------------- */

// Write operations require a token when CMS_ADMIN_TOKEN is configured.
// Left open by default so local development stays frictionless.
function requireAdmin(req, res, next) {
  const expected = process.env.CMS_ADMIN_TOKEN;
  if (!expected) return next();
  const provided = req.get('x-admin-token') || req.query.token;
  if (provided) {
    const providedBuffer = Buffer.from(String(provided));
    const expectedBuffer = Buffer.from(String(expected));
    if (
      providedBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return next();
    }
  }
  return res.status(401).json({ error: 'Unauthorized. Provide a valid x-admin-token header.' });
}

/* ------------------------------ articles -------------------------------- */

router.get('/articles', (req, res) => {
  const { category, q, status = 'published', hero } = req.query;
  const respond = () => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const heroOnly = hero === 'true' || hero === '1';
    const data = articles.list({
      category,
      q,
      status,
      limit,
      offset,
      hero: heroOnly
    });
    return res.json({ data, total: articles.count({ category, q, status, hero: heroOnly }) });
  };

  // When an admin token is configured, previews and status=all must not expose
  // draft or scheduled copy through the otherwise-public content API.
  if (status !== 'published') return requireAdmin(req, res, respond);
  return respond();
});

router.get('/articles/categories', (req, res) => {
  res.json({ data: articles.categories() });
});

router.get('/articles/:idOrSlug', (req, res) => {
  const { idOrSlug } = req.params;
  const article = /^\d+$/.test(idOrSlug)
    ? articles.getById(idOrSlug)
    : articles.getBySlug(idOrSlug);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  const respond = () => res.json({ data: article });
  if (article.status !== 'published') return requireAdmin(req, res, respond);
  return respond();
});

router.post('/articles', requireAdmin, (req, res, next) => {
  try {
    res.status(201).json({ data: articles.create(req.body || {}) });
  } catch (error) {
    next(error);
  }
});

router.put('/articles/:id', requireAdmin, (req, res, next) => {
  try {
    const updated = articles.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Article not found' });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

router.patch('/articles/:id', requireAdmin, (req, res, next) => {
  try {
    const updated = articles.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Article not found' });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/articles/:id', requireAdmin, (req, res) => {
  const removed = articles.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Article not found' });
  res.status(204).end();
});

router.get('/articles/:id/sources', (req, res) => {
  const article = articles.getById(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  const respond = () => res.json({ data: article.sources });
  if (article.status !== 'published') return requireAdmin(req, res, respond);
  return respond();
});

router.post('/articles/:id/sources', requireAdmin, (req, res, next) => {
  try {
    const source = articles.addSource(req.params.id, req.body || {});
    if (!source) return res.status(404).json({ error: 'Article not found' });
    return res.status(201).json({ data: source });
  } catch (error) {
    return next(error);
  }
});

router.delete('/articles/:id/sources/:sourceId', requireAdmin, (req, res) => {
  if (!articles.removeSource(req.params.id, req.params.sourceId)) {
    return res.status(404).json({ error: 'Source not found' });
  }
  return res.status(204).end();
});

/* ------------------------------- authors -------------------------------- */

router.get('/authors', (req, res) => res.json({ data: authors.list() }));

router.get('/authors/:idOrSlug', (req, res) => {
  const author = authors.get(req.params.idOrSlug);
  if (!author) return res.status(404).json({ error: 'Author not found' });
  return res.json({ data: author });
});

router.post('/authors', requireAdmin, (req, res, next) => {
  try {
    return res.status(201).json({ data: authors.create(req.body || {}) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/authors/:id', requireAdmin, (req, res, next) => {
  try {
    const author = authors.update(req.params.id, req.body || {});
    if (!author) return res.status(404).json({ error: 'Author not found' });
    return res.json({ data: author });
  } catch (error) {
    return next(error);
  }
});

router.delete('/authors/:id', requireAdmin, (req, res) => {
  if (!authors.remove(req.params.id)) return res.status(404).json({ error: 'Author not found' });
  return res.status(204).end();
});

/* ----------------------------- engagement -------------------------------- */

// Reactions and comments are keyed by slug so generated and legacy query-string
// article pages can use the same endpoints and share their engagement history.
// The voter id is a client-generated anonymous token, passed as a query
// parameter on reads and in the body on writes.

router.get('/articles/:slug/engagement', (req, res, next) => {
  try {
    res.json({ data: engagement.summary(req.params.slug, req.query.voterId) });
  } catch (error) {
    next(error);
  }
});

router.get('/articles/:slug/reactions', (req, res, next) => {
  try {
    res.json({ data: engagement.tallies(req.params.slug, req.query.voterId) });
  } catch (error) {
    next(error);
  }
});

router.post('/articles/:slug/reactions', (req, res, next) => {
  try {
    res.json({ data: engagement.react(req.params.slug, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

router.get('/articles/:slug/comments', (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ data: engagement.listComments(req.params.slug, { limit }) });
  } catch (error) {
    next(error);
  }
});

router.post('/articles/:slug/comments', (req, res, next) => {
  try {
    res.status(201).json({ data: engagement.addComment(req.params.slug, req.body || {}) });
  } catch (error) {
    next(error);
  }
});

// Moderation stays behind the admin token.
router.get('/comments', requireAdmin, (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ data: engagement.listAllComments({ limit }) });
  } catch (error) {
    next(error);
  }
});

router.delete('/comments/:id', requireAdmin, (req, res) => {
  if (!engagement.removeComment(req.params.id)) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  return res.status(204).end();
});

/* ------------------------------- images --------------------------------- */

router.get('/images', (req, res) => {
  res.json({ data: images.list() });
});

router.post('/images', requireAdmin, upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received (field name: image)' });

  // MIME headers are supplied by the uploader and can be spoofed. Decode the
  // file before recording it so HTML or arbitrary bytes cannot be published
  // from /uploads under an image-looking extension.
  try {
    const metadata = await sharp(req.file.path).metadata();
    if (metadata.format !== IMAGE_FORMATS.get(req.file.mimetype)) {
      throw new Error('Image content does not match its declared MIME type.');
    }
  } catch {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: 'The uploaded file is not a valid supported image.' });
  }

  try {
    const record = images.create({
      filename: req.file.filename,
      alt: req.body.alt || '',
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size
    });
    return res.status(201).json({ data: record });
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    return next(error);
  }
});

router.patch('/images/:id', requireAdmin, (req, res) => {
  const updated = images.updateAlt(req.params.id, req.body?.alt);
  if (!updated) return res.status(404).json({ error: 'Image not found' });
  res.json({ data: updated });
});

router.delete('/images/:id', requireAdmin, (req, res) => {
  if (!images.remove(req.params.id)) return res.status(404).json({ error: 'Image not found' });
  res.status(204).end();
});

/* ------------------------------ settings -------------------------------- */

router.get('/settings', (req, res) => res.json({ data: settings.all() }));

router.put('/settings', requireAdmin, (req, res) => {
  res.json({ data: settings.set(req.body || {}) });
});

/* ------------------------------- errors --------------------------------- */

router.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  if (error?.name === 'ValidationError') {
    return res.status(400).json({ error: error.message, details: error.errors });
  }
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Image too large. Maximum size is 8 MB.' });
  }
  if (Number(error?.status) >= 400 && Number(error?.status) < 500) {
    return res.status(Number(error.status)).json({ error: error.message || 'Invalid request' });
  }
  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
