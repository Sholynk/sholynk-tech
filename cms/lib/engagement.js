'use strict';

/**
 * Reader engagement: like/dislike reactions and article comments.
 *
 * Both are keyed by article *slug* instead of a foreign key into `articles`.
 * A "voter" is an anonymous browser generated id (see the front-end
 * `SholynkEngagement` client). It is not authentication; it exists to make the
 * one-vote-per-reader rule enforceable server-side as well as in the UI, so a
 * refresh or a second tab cannot inflate the counts.
 */

const { db } = require('./db');

const VALID_REACTIONS = new Set(['like', 'dislike']);

const MAX_AUTHOR_LENGTH = 60;
const MAX_COMMENT_LENGTH = 2000;
const MAX_SLUG_LENGTH = 120;
const MAX_VOTER_LENGTH = 64;
const MAX_CLIENT_ID_LENGTH = 80;

class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 400;
    this.errors = errors;
  }
}

function normalizeSlug(value) {
  const slug = String(value || '').trim().slice(0, MAX_SLUG_LENGTH);
  if (!slug) throw new ValidationError(['article slug is required']);
  return slug;
}

function normalizeVoter(value) {
  return String(value || '').trim().slice(0, MAX_VOTER_LENGTH);
}

/* ------------------------------ reactions -------------------------------- */

function tallies(slug, voterId = '') {
  const articleSlug = normalizeSlug(slug);
  const rows = db
    .prepare('SELECT type, COUNT(*) AS total FROM reactions WHERE article_slug = ? GROUP BY type')
    .all(articleSlug);

  const counts = { like: 0, dislike: 0 };
  rows.forEach((row) => {
    counts[row.type] = Number(row.total);
  });

  let mine = null;
  const voter = normalizeVoter(voterId);
  if (voter) {
    const row = db
      .prepare('SELECT type FROM reactions WHERE article_slug = ? AND voter_id = ?')
      .get(articleSlug, voter);
    mine = row ? row.type : null;
  }

  return { slug: articleSlug, likes: counts.like, dislikes: counts.dislike, mine };
}

/**
 * Records a reader's reaction.
 *
 * Idempotent per (slug, voter): submitting the same reaction twice removes it
 * (an un-vote), and submitting the opposite one switches sides. That single
 * rule covers the "no duplicate spam-clicking" requirement without needing the
 * client to reason about previous state.
 */
function react(slug, { voterId, type } = {}) {
  const articleSlug = normalizeSlug(slug);
  const voter = normalizeVoter(voterId);
  const errors = [];

  if (!voter) errors.push('voterId is required');
  if (!VALID_REACTIONS.has(type)) errors.push("type must be 'like' or 'dislike'");
  if (errors.length) throw new ValidationError(errors);

  const existing = db
    .prepare('SELECT id, type FROM reactions WHERE article_slug = ? AND voter_id = ?')
    .get(articleSlug, voter);

  if (!existing) {
    db.prepare('INSERT INTO reactions (article_slug, voter_id, type) VALUES (?, ?, ?)')
      .run(articleSlug, voter, type);
  } else if (existing.type === type) {
    db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
  } else {
    db.prepare("UPDATE reactions SET type = ?, updated_at = datetime('now') WHERE id = ?")
      .run(type, existing.id);
  }

  return tallies(articleSlug, voter);
}

/* ------------------------------- comments -------------------------------- */

function toCommentApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.article_slug,
    author: row.author,
    body: row.body,
    clientId: row.client_id || '',
    createdAt: row.created_at
  };
}

function listComments(slug, { limit } = {}) {
  const articleSlug = normalizeSlug(slug);
  let sql = 'SELECT * FROM comments WHERE article_slug = ? ORDER BY id DESC';
  const params = [articleSlug];
  if (Number.isFinite(limit)) {
    sql += ' LIMIT ?';
    params.push(limit);
  }
  return db.prepare(sql).all(...params).map(toCommentApi);
}

/**
 * Full comment history across every article, newest first — the record the
 * admin dashboard shows. Includes the article title for context.
 */
function listAllComments({ limit } = {}) {
  let sql = `
    SELECT c.*, a.title AS article_title
    FROM comments c
    LEFT JOIN articles a ON a.slug = c.article_slug
    ORDER BY c.id DESC
  `;
  const params = [];
  if (Number.isFinite(limit)) {
    sql += ' LIMIT ?';
    params.push(limit);
  }
  return db.prepare(sql).all(...params).map((row) => ({
    id: row.id,
    articleSlug: row.article_slug,
    articleTitle: row.article_title || row.article_slug,
    author: row.author,
    body: row.body,
    clientId: row.client_id || '',
    createdAt: row.created_at
  }));
}

function countComments(slug) {
  const row = db
    .prepare('SELECT COUNT(*) AS total FROM comments WHERE article_slug = ?')
    .get(normalizeSlug(slug));
  return Number(row?.total || 0);
}

function addComment(slug, { author, body, voterId, clientId } = {}) {
  const articleSlug = normalizeSlug(slug);
  const errors = [];

  const cleanAuthor = String(author || '').trim().replace(/\s+/g, ' ');
  const cleanBody = String(body || '').trim();
  const cleanClientId = String(clientId || '').trim().slice(0, MAX_CLIENT_ID_LENGTH);

  if (!cleanAuthor) errors.push('name is required');
  if (cleanAuthor.length > MAX_AUTHOR_LENGTH) {
    errors.push(`name must be ${MAX_AUTHOR_LENGTH} characters or fewer`);
  }
  if (!cleanBody) errors.push('comment is required');
  if (cleanBody.length > MAX_COMMENT_LENGTH) {
    errors.push(`comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }
  if (errors.length) throw new ValidationError(errors);

  // Idempotency: a submission carries a client-generated id so a retried
  // request (timeout, offline queue sync, double-tab) returns the original
  // comment instead of creating a duplicate.
  if (cleanClientId) {
    const existing = db
      .prepare('SELECT * FROM comments WHERE article_slug = ? AND client_id = ?')
      .get(articleSlug, cleanClientId);
    if (existing) return toCommentApi(existing);
  }

  const info = db
    .prepare('INSERT INTO comments (article_slug, author, body, voter_id, client_id) VALUES (?, ?, ?, ?, ?)')
    .run(articleSlug, cleanAuthor, cleanBody, normalizeVoter(voterId), cleanClientId);

  return toCommentApi(db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid));
}

function removeComment(id) {
  const row = db.prepare('SELECT id FROM comments WHERE id = ?').get(Number(id));
  if (!row) return false;
  db.prepare('DELETE FROM comments WHERE id = ?').run(row.id);
  return true;
}

/** Everything a page needs for its engagement widgets, in one round trip. */
function summary(slug, voterId = '') {
  const articleSlug = normalizeSlug(slug);
  return {
    reactions: tallies(articleSlug, voterId),
    comments: listComments(articleSlug)
  };
}

module.exports = {
  tallies,
  react,
  listComments,
  listAllComments,
  countComments,
  addComment,
  removeComment,
  summary,
  ValidationError,
  MAX_AUTHOR_LENGTH,
  MAX_COMMENT_LENGTH
};
