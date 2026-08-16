'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const articles = require('../lib/articles');
const images = require('../lib/images');
const settings = require('../lib/settings');
const engagement = require('../lib/engagement');
const authors = require('../lib/authors');
const pdfImport = require('../lib/pdf-import');
const notifications = require('../lib/notifications');
const analytics = require('../lib/analytics');
const events = require('../lib/events');
const { db } = require('../lib/db');

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
// Left open by default so local development stays frictionless. When a token
// is set, any route that calls requireAdmin rejects unauthenticated requests,
// which also protects unpublished articles (draft/pending/scheduled) from the
// public content API.
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
  // Fall through to 401.
  return res.status(401).json({ error: 'Unauthorized. Provide a valid x-admin-token header.' });
}

/* ------------------------------ articles -------------------------------- */

router.get('/articles', (req, res) => {
  const { category, q, status: requestedStatus = 'published', hero } = req.query;
  // The public site only ever fetches status=published. Anything else (drafts,
  // pending review, scheduled, all) is admin-only.
  if (requestedStatus !== 'published') {
    return requireAdmin(req, res, () => respond(requestedStatus));
  }
  return respond(requestedStatus);

  function respond(status) {
    const effectiveStatus = status === 'all' ? undefined : status;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const heroOnly = hero === 'true' || hero === '1';
    const data = articles.list({
      category,
      q,
      status: effectiveStatus,
      limit,
      offset,
      hero: heroOnly
    });
    return res.json({ data, total: articles.count({ category, q, status: effectiveStatus, hero: heroOnly }) });
  }
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

function requireSubmissionFields(payload, { isNew = false } = {}) {
  const errors = [];
  const requireString = (key, label, min = 1) => {
    const v = String(payload[key] || '').trim();
    if (v.length < min) errors.push(`${label} is required${min > 1 ? ` (min ${min} characters)` : ''}`);
    return v;
  };
  if (payload.status === 'pending') {
    requireString('title', 'Title', 6);
    requireString('category', 'Category');
    const body = String(payload.body || '').trim();
    if (body.length < 200) errors.push('Article body must be at least 200 characters for review');
    if (!/<h2\b/i.test(body) && !/^##\s+/m.test(body)) {
      errors.push('Add at least one <h2> section heading or Markdown ## heading so readers can navigate the article');
    }
    const desc = String(payload.description || '').trim();
    if (desc.length < 40) errors.push('Description/teaser is required (min 40 characters)');
    if (desc.length > 200) errors.push('Description must be under 200 characters');
    if (isNew && !String(payload.author || '').trim()) {
      errors.push('Author name is required');
    }
    const tags = Array.isArray(payload.tags) ? payload.tags : [];
    if (tags.length < 2) errors.push('Add at least 2 tags');
    if (String(payload.img || '').trim() && !String(payload.alt || '').trim()) {
      errors.push('Image alt text is required whenever a hero image is set');
    }
  }
  if (errors.length) {
    const error = new Error(errors.join('; '));
    error.status = 400;
    error.details = errors;
    throw error;
  }
}

function recordSubmission(article, notes = '') {
  if (!article) return null;
  try {
    db.prepare(`INSERT INTO submissions
      (article_id, article_slug, title, author_name, submitter_email, notes)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      Number(article.id),
      String(article.slug || ''),
      String(article.title || ''),
      String(article.author || ''),
      String(article.submitterEmail || ''),
      String(notes || '')
    );
    db.prepare("UPDATE articles SET submitted_at = COALESCE(submitted_at, datetime('now')) WHERE id = ?")
      .run(Number(article.id));
  } catch (err) {
    console.error('[notifications] Failed to record submission row', err);
  }
  return article;
}

router.post('/articles', requireAdmin, async (req, res, next) => {
  try {
    const payload = req.body || {};
    // If CMS_REQUIRE_APPROVAL is set, force non-draft, non-published saves
    // into "pending" so editors can't self-publish by accident.
    if (process.env.CMS_REQUIRE_APPROVAL === 'true' && payload.status === 'published') {
      payload.status = 'pending';
    }
    requireSubmissionFields(payload, { isNew: true });
    const created = articles.create(payload);
    let data = created;
    if (created.status === 'pending') {
      recordSubmission(created, payload.reviewNotes || '');
      await notifications.notifyReviewNeeded(created).catch((err) => console.error(err));
      data = { ...created, reviewNotice: 'Article submitted for review. Sholynk Tech has been notified.' };
    }
    events.publish('article', { slug: created.slug, status: created.status });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

router.put('/articles/:id', requireAdmin, async (req, res, next) => {
  try {
    const payload = req.body || {};
    const existing = articles.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Article not found' });
    // Only allow publishing directly if CMS_REQUIRE_APPROVAL is not enforced
    // or the user is explicitly setting status to "published" while approval
    // mode is off. Draft -> pending transitions always validate.
    if (process.env.CMS_REQUIRE_APPROVAL === 'true' && payload.status === 'published' && existing.status !== 'published') {
      payload.status = 'pending';
    }
    requireSubmissionFields({ ...existing, ...payload }, { isNew: false });
    const updated = articles.update(req.params.id, payload);
    if (!updated) return res.status(404).json({ error: 'Article not found' });
    let data = updated;
    if (updated.status === 'pending' && existing.status !== 'pending') {
      recordSubmission(updated, payload.reviewNotes || '');
      await notifications.notifyReviewNeeded(updated).catch((err) => console.error(err));
      data = { ...updated, reviewNotice: 'Article submitted for review. Sholynk Tech has been notified.' };
    }
    events.publish('article', { slug: updated.slug, status: updated.status });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.patch('/articles/:id', requireAdmin, async (req, res, next) => {
  try {
    const payload = req.body || {};
    const existing = articles.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Article not found' });
    if (process.env.CMS_REQUIRE_APPROVAL === 'true' && payload.status === 'published' && existing.status !== 'published') {
      payload.status = 'pending';
    }
    requireSubmissionFields({ ...existing, ...payload }, { isNew: false });
    const updated = articles.update(req.params.id, payload);
    if (!updated) return res.status(404).json({ error: 'Article not found' });
    let data = updated;
    if (updated.status === 'pending' && existing.status !== 'pending') {
      recordSubmission(updated, payload.reviewNotes || '');
      await notifications.notifyReviewNeeded(updated).catch((err) => console.error(err));
      data = { ...updated, reviewNotice: 'Article submitted for review. Sholynk Tech has been notified.' };
    }
    events.publish('article', { slug: updated.slug, status: updated.status });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.delete('/articles/:id', requireAdmin, (req, res) => {
  const removed = articles.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Article not found' });
  events.publish('article');
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
    const author = authors.create(req.body || {});
    events.publish('author', { slug: author.slug });
    return res.status(201).json({ data: author });
  } catch (error) {
    return next(error);
  }
});

router.patch('/authors/:id', requireAdmin, (req, res, next) => {
  try {
    const author = authors.update(req.params.id, req.body || {});
    if (!author) return res.status(404).json({ error: 'Author not found' });
    events.publish('author', { slug: author.slug });
    return res.json({ data: author });
  } catch (error) {
    return next(error);
  }
});

router.delete('/authors/:id', requireAdmin, (req, res, next) => {
  try {
    // Removing the site owner is refused with a 400, not a crash: every
    // article falls back to that profile.
    if (!authors.remove(req.params.id)) return res.status(404).json({ error: 'Author not found' });
    events.publish('author');
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
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
    const data = engagement.react(req.params.slug, req.body || {});
    events.publish('reaction', { slug: req.params.slug });
    res.json({ data });
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
    const data = engagement.addComment(req.params.slug, req.body || {});
    events.publish('comment', { slug: req.params.slug });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------ analytics ------------------------------- */

/**
 * Records one article read. Public and unauthenticated by design: it is called
 * by readers. `recordView` only accepts slugs that exist and collapses repeat
 * reads by the same anonymous viewer on the same day, so the endpoint cannot be
 * used to write arbitrary rows or inflate a count by refreshing.
 */
router.post('/articles/:slug/views', (req, res, next) => {
  try {
    const result = analytics.recordView(req.params.slug, req.body || {});
    if (result.counted) events.publish('view', { slug: req.params.slug });
    res.status(202).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/overview', requireAdmin, (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined;
    res.json({ data: analytics.overview({ days }) });
  } catch (error) {
    next(error);
  }
});

/**
 * Live dashboard updates over Server-Sent Events.
 *
 * Only a change *signal* is pushed, never figures: the dashboard refetches the
 * aggregates when it is nudged. That keeps a dropped reconnect or a duplicated
 * event harmless, and means the stream stays tiny no matter how much traffic
 * the site is getting.
 */
router.get('/analytics/stream', requireAdmin, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Proxies that buffer would defeat the point of a stream.
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 5000\n\n');
  res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

  const unsubscribe = events.subscribe((event) => {
    res.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
  });

  // Idle connections are dropped by proxies and some hosts after ~60s; a
  // comment frame keeps the socket warm without waking the client.
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  heartbeat.unref?.();

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
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
  events.publish('comment');
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

/* --------------------------- PDF import -------------------------------- */

// Store uploaded PDFs to a temp directory and delete them once parsed.
const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'manuscript';
    cb(null, `sholynk-pdf-${base}-${crypto.randomBytes(6).toString('hex')}.pdf`);
  }
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const error = new Error('Only PDF files are accepted for import.');
      error.status = 400;
      cb(error);
      return;
    }
    cb(null, true);
  }
});

router.post('/import/pdf', requireAdmin, pdfUpload.single('pdf'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file received (field name: pdf)' });
  try {
    const draft = await pdfImport.extractPdfDraft(req.file.path);
    return res.json({ data: draft });
  } catch (error) {
    return next(error);
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
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
