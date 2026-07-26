'use strict';

const { db } = require('./db');

const VALID_STATUS = new Set(['published', 'draft']);

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

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    description: row.description,
    body: row.body,
    img: row.img,
    alt: row.alt,
    author: row.author,
    date: row.published_at,
    readingTime: row.reading_time,
    featured: Boolean(row.featured),
    status: row.status,
    hero: Boolean(row.hero),
    heroOrder: row.hero_order,
    externalLink: row.external_link || null,
    seoTitle: row.seo_title || null,
    seoDescription: row.seo_description || null,
    // Front-end convenience: where the card should point.
    link: row.external_link || `article.html?slug=${encodeURIComponent(row.slug)}`,
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
  if (has('img') && payload.img && has('alt') && !String(payload.alt || '').trim()) {
    errors.push('alt text is required whenever an image is set (accessibility)');
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
    clauses.push('(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(category) LIKE ?)');
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like);
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
  const rows = list({ category, q, status });
  return rows.length;
}

function getById(id) {
  return toApi(db.prepare('SELECT * FROM articles WHERE id = ?').get(Number(id)));
}

function getBySlug(slug) {
  return toApi(db.prepare('SELECT * FROM articles WHERE slug = ?').get(String(slug)));
}

function create(payload = {}) {
  validate(payload);
  const slug = uniqueSlug(slugify(payload.slug || payload.title));
  const info = db.prepare(`
    INSERT INTO articles
      (slug, title, category, description, body, img, alt, author, published_at,
       reading_time, featured, status, hero, hero_order, external_link, seo_title, seo_description)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    slug,
    String(payload.title).trim(),
    String(payload.category).trim(),
    String(payload.description || ''),
    String(payload.body || ''),
    String(payload.img || ''),
    String(payload.alt || ''),
    String(payload.author || 'Sholynk Editorial'),
    String(payload.date || payload.publishedAt || new Date().toISOString().slice(0, 10)),
    String(payload.readingTime || estimateReadingTime(payload.body)),
    payload.featured ? 1 : 0,
    VALID_STATUS.has(payload.status) ? payload.status : 'published',
    payload.hero ? 1 : 0,
    payload.heroOrder == null || payload.heroOrder === '' ? null : Number(payload.heroOrder),
    payload.externalLink || null,
    payload.seoTitle || null,
    payload.seoDescription || null
  );
  return getById(info.lastInsertRowid);
}

const FIELD_MAP = {
  title: 'title',
  category: 'category',
  description: 'description',
  body: 'body',
  img: 'img',
  alt: 'alt',
  author: 'author',
  date: 'published_at',
  publishedAt: 'published_at',
  readingTime: 'reading_time',
  status: 'status',
  externalLink: 'external_link',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description'
};

function update(id, payload = {}) {
  const existing = getById(id);
  if (!existing) return null;
  validate({ ...existing, ...payload }, { partial: true });

  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      sets.push(`${column} = ?`);
      params.push(payload[key] == null ? '' : String(payload[key]));
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

  if (!sets.length) return existing;

  sets.push("updated_at = datetime('now')");
  params.push(existing.id);
  db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getById(existing.id);
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
  list,
  count,
  getById,
  getBySlug,
  create,
  update,
  remove,
  categories,
  slugify,
  estimateReadingTime,
  ValidationError
};
