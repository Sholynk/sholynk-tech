'use strict';

const { db } = require('./db');

const VALID_STATUS = new Set(['published', 'draft', 'scheduled']);
const VALID_CONTENT_TYPES = new Set(['article', 'news', 'guide', 'opinion', 'review', 'analysis']);
const VALID_SOURCE_TYPES = new Set(['primary', 'official', 'research', 'journalism', 'reference', 'other']);

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function uniqueSlug(base, ignoreId = null) {
  let slug = base || `article-${Date.now()}`;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = ignoreId
      ? db.prepare('SELECT id FROM articles WHERE slug = ? AND id != ?').get(slug, ignoreId)
      : db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
    if (!row) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function parseJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value || '');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function asJson(value, fallback = []) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return JSON.stringify(fallback);
    }
  }
  return JSON.stringify(value == null ? fallback : value);
}

function sourceToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    articleId: row.article_id,
    title: row.title,
    publisher: row.publisher,
    author: row.author,
    publishedAt: row.published_at,
    url: row.url,
    type: row.type,
    doi: row.doi,
    accessedAt: row.accessed_at,
    supports: row.supports,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sourcesForArticle(articleId) {
  return db.prepare('SELECT * FROM article_sources WHERE article_id = ? ORDER BY id ASC')
    .all(Number(articleId))
    .map(sourceToApi);
}

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    subcategory: row.subcategory || '',
    tags: parseJson(row.tags_json),
    contentType: row.content_type || 'article',
    description: row.description,
    hook: row.hook || '',
    directAnswer: row.direct_answer || '',
    keyTakeaways: parseJson(row.key_takeaways_json),
    faqs: parseJson(row.faqs_json),
    relatedSlugs: parseJson(row.related_slugs_json),
    body: row.body,
    img: row.img,
    alt: row.alt,
    author: row.author,
    authorSlug: row.author_slug || '',
    date: row.published_at,
    readingTime: row.reading_time,
    featured: Boolean(row.featured),
    status: row.status,
    scheduledAt: row.scheduled_at || null,
    reviewNotes: row.review_notes || '',
    hero: Boolean(row.hero),
    heroOrder: row.hero_order,
    externalLink: row.external_link || null,
    canonicalUrl: row.canonical_url || null,
    seoTitle: row.seo_title || null,
    seoDescription: row.seo_description || null,
    sources: sourcesForArticle(row.id),
    // Full articles use the generated clean path; the legacy query route still resolves.
    link: row.external_link || (row.body
      ? `articles/${encodeURIComponent(row.slug)}/`
      : `article.html?slug=${encodeURIComponent(row.slug)}`),
    cleanLink: row.external_link || `articles/${encodeURIComponent(row.slug)}/`,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 400;
    this.errors = errors;
  }
}

function validHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validHttpsUrl(value) {
  if (!value) return true;
  try {
    return new URL(String(value)).protocol === 'https:';
  } catch {
    return false;
  }
}

function validLink(value) {
  if (!value) return true;
  if (validHttpUrl(value)) return true;
  const link = String(value).trim();
  return !/[\\\u0000-\u001f]/.test(link)
    && !/^[a-z][a-z0-9+.-]*:/i.test(link)
    && !link.startsWith('//');
}

function validate(payload, { partial = false } = {}) {
  const errors = [];
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);

  if (!partial || has('title')) {
    if (!String(payload.title || '').trim()) errors.push('title is required');
  }
  if (!partial || has('category')) {
    if (!String(payload.category || '').trim()) errors.push('category is required');
  }
  if (has('status') && payload.status && !VALID_STATUS.has(payload.status)) {
    errors.push(`status must be one of: ${[...VALID_STATUS].join(', ')}`);
  }
  if (has('contentType') && payload.contentType && !VALID_CONTENT_TYPES.has(payload.contentType)) {
    errors.push(`contentType must be one of: ${[...VALID_CONTENT_TYPES].join(', ')}`);
  }
  if (has('img') && payload.img && !String(payload.alt || '').trim()) {
    errors.push('alt text is required whenever an image is set (accessibility)');
  }
  if (has('externalLink') && !validLink(payload.externalLink)) {
    errors.push('externalLink must be an HTTP(S) URL or safe local path');
  }
  if (has('canonicalUrl') && !validHttpsUrl(payload.canonicalUrl)) {
    errors.push('canonicalUrl must be an absolute HTTPS URL');
  }
  if ((payload.status === 'scheduled') && !String(payload.scheduledAt || '').trim()) {
    errors.push('scheduledAt is required when status is scheduled');
  }
  for (const key of ['tags', 'keyTakeaways', 'relatedSlugs']) {
    if (has(key) && !Array.isArray(payload[key])) errors.push(`${key} must be an array`);
  }
  if (Array.isArray(payload.tags) && payload.tags.some((tag) => !String(tag || '').trim())) {
    errors.push('tags cannot contain empty values');
  }
  if (Array.isArray(payload.keyTakeaways) && payload.keyTakeaways.some((item) => !String(item || '').trim())) {
    errors.push('keyTakeaways cannot contain empty values');
  }
  if (Array.isArray(payload.relatedSlugs) && payload.relatedSlugs.some((slug) => slugify(slug) !== slug)) {
    errors.push('relatedSlugs must contain lowercase hyphenated slugs');
  }
  if (payload.authorSlug && slugify(payload.authorSlug) !== payload.authorSlug) {
    errors.push('authorSlug must be a lowercase hyphenated slug');
  }
  if (has('faqs')) {
    const faqs = payload.faqs;
    if (!Array.isArray(faqs) || faqs.some((faq) => !faq || !String(faq.question || '').trim() || !String(faq.answer || '').trim())) {
      errors.push('faqs must be an array containing question and answer values');
    }
  }
  const publishedAt = payload.date || payload.publishedAt;
  if (publishedAt && Number.isNaN(new Date(publishedAt).valueOf())) errors.push('date must be a valid date');
  if (payload.scheduledAt && Number.isNaN(new Date(payload.scheduledAt).valueOf())) {
    errors.push('scheduledAt must be a valid date and time');
  }
  if (errors.length) throw new ValidationError(errors);
}

function estimateReadingTime(body = '') {
  const words = String(body).trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function list({ category, q, status, limit, offset, hero } = {}) {
  const clauses = [];
  const params = [];

  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }
  if (category && category !== 'All') {
    clauses.push('category = ?');
    params.push(category);
  }
  if (hero === true) clauses.push('hero = 1');
  if (q) {
    clauses.push('(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(category) LIKE ? OR lower(tags_json) LIKE ?)');
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  let sql = `SELECT * FROM articles${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}`;
  sql += ' ORDER BY featured DESC, hero_order IS NULL, hero_order ASC, date(published_at) DESC, id DESC';
  if (Number.isFinite(limit)) {
    sql += ' LIMIT ?';
    params.push(limit);
    if (Number.isFinite(offset)) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
  }
  return db.prepare(sql).all(...params).map(toApi);
}

function count({ category, q, status } = {}) {
  return list({ category, q, status }).length;
}

function getById(id) {
  return toApi(db.prepare('SELECT * FROM articles WHERE id = ?').get(Number(id)));
}

function getBySlug(slug) {
  return toApi(db.prepare('SELECT * FROM articles WHERE slug = ?').get(String(slug)));
}

const INSERT_FIELDS = [
  'slug', 'title', 'category', 'description', 'body', 'img', 'alt', 'author', 'author_slug', 'published_at',
  'reading_time', 'featured', 'status', 'hero', 'hero_order', 'external_link', 'seo_title',
  'seo_description', 'content_type', 'subcategory', 'tags_json', 'hook', 'direct_answer',
  'key_takeaways_json', 'faqs_json', 'related_slugs_json', 'canonical_url', 'scheduled_at',
  'review_notes'
];

function create(payload = {}) {
  validate(payload);
  if (!Array.isArray(payload.sources || [])) throw new ValidationError(['sources must be an array']);
  (payload.sources || []).forEach(validateSource);
  const slug = uniqueSlug(slugify(payload.slug || payload.title));
  const values = [
    slug,
    String(payload.title).trim(),
    String(payload.category).trim(),
    String(payload.description || ''),
    String(payload.body || ''),
    String(payload.img || ''),
    String(payload.alt || ''),
    String(payload.author || 'Sholynk Editorial'),
    String(payload.authorSlug || ''),
    String(payload.date || payload.publishedAt || new Date().toISOString().slice(0, 10)),
    String(payload.readingTime || estimateReadingTime(payload.body)),
    payload.featured ? 1 : 0,
    VALID_STATUS.has(payload.status) ? payload.status : 'published',
    payload.hero ? 1 : 0,
    payload.heroOrder == null || payload.heroOrder === '' ? null : Number(payload.heroOrder),
    payload.externalLink || null,
    payload.seoTitle || null,
    payload.seoDescription || null,
    VALID_CONTENT_TYPES.has(payload.contentType) ? payload.contentType : 'article',
    String(payload.subcategory || ''),
    asJson(payload.tags),
    String(payload.hook || ''),
    String(payload.directAnswer || ''),
    asJson(payload.keyTakeaways),
    asJson(payload.faqs),
    asJson(payload.relatedSlugs),
    payload.canonicalUrl || null,
    payload.scheduledAt || null,
    String(payload.reviewNotes || '')
  ];
  const placeholders = INSERT_FIELDS.map(() => '?').join(',');
  const info = db.prepare(`INSERT INTO articles (${INSERT_FIELDS.join(',')}) VALUES (${placeholders})`).run(...values);
  replaceSources(info.lastInsertRowid, payload.sources || []);
  return getById(info.lastInsertRowid);
}

const FIELD_MAP = {
  title: 'title', category: 'category', subcategory: 'subcategory', contentType: 'content_type',
  description: 'description', hook: 'hook', directAnswer: 'direct_answer', body: 'body', img: 'img',
  alt: 'alt', author: 'author', authorSlug: 'author_slug', date: 'published_at', publishedAt: 'published_at',
  readingTime: 'reading_time', status: 'status', scheduledAt: 'scheduled_at', reviewNotes: 'review_notes',
  externalLink: 'external_link', canonicalUrl: 'canonical_url', seoTitle: 'seo_title',
  seoDescription: 'seo_description'
};

const JSON_FIELD_MAP = {
  tags: 'tags_json', keyTakeaways: 'key_takeaways_json', faqs: 'faqs_json', relatedSlugs: 'related_slugs_json'
};

function update(id, payload = {}) {
  const existing = getById(id);
  if (!existing) return null;
  validate({ ...existing, ...payload }, { partial: true });
  if (Object.prototype.hasOwnProperty.call(payload, 'sources')) {
    if (!Array.isArray(payload.sources)) throw new ValidationError(['sources must be an array']);
    payload.sources.forEach(validateSource);
  }

  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      sets.push(`${column} = ?`);
      params.push(payload[key] == null ? '' : String(payload[key]));
    }
  }
  for (const [key, column] of Object.entries(JSON_FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      sets.push(`${column} = ?`);
      params.push(asJson(payload[key]));
    }
  }
  for (const key of ['featured', 'hero']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      sets.push(`${key} = ?`);
      params.push(payload[key] ? 1 : 0);
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'heroOrder')) {
    sets.push('hero_order = ?');
    params.push(payload.heroOrder === '' || payload.heroOrder == null ? null : Number(payload.heroOrder));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'slug') && payload.slug) {
    sets.push('slug = ?');
    params.push(uniqueSlug(slugify(payload.slug), existing.id));
  }

  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    params.push(existing.id);
    db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'sources')) replaceSources(existing.id, payload.sources);
  return getById(existing.id);
}

function validateSource(source = {}) {
  const errors = [];
  if (!String(source.title || '').trim()) errors.push('source title is required');
  if (!String(source.url || '').trim() || !validHttpUrl(source.url)) {
    errors.push('source URL must be an absolute HTTP(S) URL');
  }
  if (source.type && !VALID_SOURCE_TYPES.has(source.type)) {
    errors.push(`source type must be one of: ${[...VALID_SOURCE_TYPES].join(', ')}`);
  }
  if (errors.length) throw new ValidationError(errors);
}

function replaceSources(articleId, sources = []) {
  if (!Array.isArray(sources)) throw new ValidationError(['sources must be an array']);
  sources.forEach(validateSource);
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM article_sources WHERE article_id = ?').run(Number(articleId));
    const insert = db.prepare(`
      INSERT INTO article_sources
        (article_id, title, publisher, author, published_at, url, type, doi, accessed_at, supports)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    for (const source of sources) {
      insert.run(
        Number(articleId), String(source.title).trim(), String(source.publisher || ''),
        String(source.author || ''), String(source.publishedAt || ''), String(source.url),
        VALID_SOURCE_TYPES.has(source.type) ? source.type : 'journalism', String(source.doi || ''),
        String(source.accessedAt || ''), String(source.supports || '')
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function addSource(articleId, source = {}) {
  const article = getById(articleId);
  if (!article) return null;
  validateSource(source);
  const info = db.prepare(`
    INSERT INTO article_sources
      (article_id, title, publisher, author, published_at, url, type, doi, accessed_at, supports)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    article.id, String(source.title).trim(), String(source.publisher || ''), String(source.author || ''),
    String(source.publishedAt || ''), String(source.url),
    VALID_SOURCE_TYPES.has(source.type) ? source.type : 'journalism', String(source.doi || ''),
    String(source.accessedAt || ''), String(source.supports || '')
  );
  return sourceToApi(db.prepare('SELECT * FROM article_sources WHERE id = ?').get(info.lastInsertRowid));
}

function removeSource(articleId, sourceId) {
  const result = db.prepare('DELETE FROM article_sources WHERE id = ? AND article_id = ?')
    .run(Number(sourceId), Number(articleId));
  return result.changes > 0;
}

function remove(id) {
  const existing = getById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM articles WHERE id = ?').run(existing.id);
  return true;
}

function categories() {
  return db.prepare('SELECT DISTINCT category FROM articles ORDER BY category ASC')
    .all()
    .map((row) => row.category);
}

module.exports = {
  list, count, getById, getBySlug, create, update, remove, categories, slugify,
  estimateReadingTime, replaceSources, sourcesForArticle, addSource, removeSource, validate, ValidationError,
  VALID_STATUS, VALID_CONTENT_TYPES, VALID_SOURCE_TYPES
};
