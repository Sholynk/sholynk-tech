'use strict';

const { db } = require('./db');
const { slugify, ValidationError } = require('./articles');

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    bio: row.bio,
    role: row.role,
    image: row.image,
    imageAlt: row.image_alt,
    profileUrl: row.profile_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validate(payload) {
  const errors = [];
  if (!String(payload.name || '').trim()) errors.push('author name is required');
  if (payload.image && !String(payload.imageAlt || '').trim()) {
    errors.push('author imageAlt is required whenever an image is set');
  }
  if (payload.profileUrl) {
    try {
      const url = new URL(payload.profileUrl);
      if (url.protocol !== 'https:') throw new Error('invalid');
    } catch {
      errors.push('author profileUrl must be an absolute HTTPS URL');
    }
  }
  if (errors.length) throw new ValidationError(errors);
}

function list() {
  return db.prepare('SELECT * FROM authors ORDER BY name ASC').all().map(toApi);
}

function get(idOrSlug) {
  const row = /^\d+$/.test(String(idOrSlug))
    ? db.prepare('SELECT * FROM authors WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM authors WHERE slug = ?').get(String(idOrSlug));
  return toApi(row);
}

function uniqueSlug(value, ignoreId = null) {
  const base = slugify(value) || 'author';
  let candidate = base;
  let suffix = 2;
  while (true) {
    const found = ignoreId
      ? db.prepare('SELECT id FROM authors WHERE slug = ? AND id != ?').get(candidate, Number(ignoreId))
      : db.prepare('SELECT id FROM authors WHERE slug = ?').get(candidate);
    if (!found) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

function create(payload = {}) {
  validate(payload);
  const info = db.prepare(`
    INSERT INTO authors (slug, name, bio, role, image, image_alt, profile_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uniqueSlug(payload.slug || payload.name), String(payload.name).trim(), String(payload.bio || ''),
    String(payload.role || ''), String(payload.image || ''), String(payload.imageAlt || ''),
    String(payload.profileUrl || '')
  );
  return get(info.lastInsertRowid);
}

function update(id, payload = {}) {
  const existing = get(id);
  if (!existing) return null;
  const merged = { ...existing, ...payload };
  validate(merged);
  const slug = Object.prototype.hasOwnProperty.call(payload, 'slug')
    ? uniqueSlug(payload.slug || merged.name, existing.id)
    : existing.slug;
  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE authors SET slug = ?, name = ?, bio = ?, role = ?, image = ?, image_alt = ?,
        profile_url = ?, updated_at = datetime('now') WHERE id = ?
    `).run(
      slug, String(merged.name).trim(), String(merged.bio || ''), String(merged.role || ''),
      String(merged.image || ''), String(merged.imageAlt || ''), String(merged.profileUrl || ''),
      existing.id
    );
    if (slug !== existing.slug) {
      db.prepare("UPDATE articles SET author_slug = ?, updated_at = datetime('now') WHERE author_slug = ?")
        .run(slug, existing.slug);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return get(existing.id);
}

function remove(id) {
  const existing = get(id);
  if (!existing) return false;
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE articles SET author_slug = '', updated_at = datetime('now') WHERE author_slug = ?")
      .run(existing.slug);
    db.prepare('DELETE FROM authors WHERE id = ?').run(existing.id);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * The house author. `image` points at the same portrait the About page uses, so
 * the article author card and the About profile never drift apart.
 */
const DEFAULT_AUTHOR = {
  slug: 'oluwashola-busari',
  name: 'Oluwashola Busari',
  role: 'Founder, Software Engineer and Tech Journalist',
  bio: 'The founder of Sholynk Technology. Has a background in Mass Communication, Software Engineering, Digital Marketing, and Data Analysis. He is focused on explaining technical concepts in very simple terms.',
  image: 'Images and Assets/my_pic.png',
  imageAlt: 'Portrait photo of Oluwashola Busari',
  profileUrl: 'https://sholynktech.netlify.app/about.html'
};

/**
 * Creates the default author on a fresh database. On an existing installation
 * the record is kept, and only fields that were never filled in (an empty photo
 * or bio) are backfilled — anything edited in the admin is left untouched.
 */
function ensureDefault() {
  const existing = db.prepare('SELECT * FROM authors WHERE slug = ?').get(DEFAULT_AUTHOR.slug);
  if (!existing) return create(DEFAULT_AUTHOR);

  const patch = {};
  if (!String(existing.image || '').trim()) {
    patch.image = DEFAULT_AUTHOR.image;
    patch.imageAlt = String(existing.image_alt || '').trim() || DEFAULT_AUTHOR.imageAlt;
  }
  if (!String(existing.bio || '').trim()) patch.bio = DEFAULT_AUTHOR.bio;
  if (Object.keys(patch).length) return update(existing.id, patch);
  return toApi(existing);
}

ensureDefault();

module.exports = { list, get, create, update, remove, ensureDefault };
