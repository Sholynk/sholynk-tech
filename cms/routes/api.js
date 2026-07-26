'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const articles = require('../lib/articles');
const images = require('../lib/images');
const settings = require('../lib/settings');

const router = express.Router();

/* ------------------------------- uploads -------------------------------- */

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, images.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
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
      cb(new Error('Unsupported image type. Use JPEG, PNG, WebP, GIF or AVIF.'));
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
  if (provided && crypto.timingSafeEqual(
    Buffer.from(String(provided).padEnd(64).slice(0, 64)),
    Buffer.from(String(expected).padEnd(64).slice(0, 64))
  )) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Provide a valid x-admin-token header.' });
}

/* ------------------------------ articles -------------------------------- */

router.get('/articles', (req, res) => {
  const { category, q, status = 'published', hero } = req.query;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;
  const data = articles.list({
    category,
    q,
    status,
    limit,
    offset,
    hero: hero === 'true' || hero === '1'
  });
  res.json({ data, total: articles.count({ category, q, status }) });
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
  res.json({ data: article });
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

/* ------------------------------- images --------------------------------- */

router.get('/images', (req, res) => {
  res.json({ data: images.list() });
});

router.post('/images', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received (field name: image)' });
  const record = images.create({
    filename: req.file.filename,
    alt: req.body.alt || '',
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size
  });
  res.status(201).json({ data: record });
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
  console.error(error);
  return res.status(error?.status || 500).json({ error: error?.message || 'Internal server error' });
});

module.exports = router;
