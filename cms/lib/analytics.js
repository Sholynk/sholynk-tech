'use strict';

/**
 * Editorial analytics: the aggregate figures behind the admin dashboard.
 *
 * Everything here is derived on read from the tables the site already writes
 * to (articles, authors, reactions, comments, submissions) plus `article_views`,
 * which this module owns. There is no separate metrics store to keep in sync,
 * so a number on the dashboard can never disagree with the content it counts.
 *
 * Readers are identified only by the anonymous browser id the engagement
 * widgets already generate. No accounts, no IP addresses, no personal data.
 */

const { db } = require('./db');

const MAX_SLUG_LENGTH = 120;
const MAX_VIEWER_LENGTH = 64;

/** Statuses reported individually; anything else is folded into "other". */
const REPORTED_STATUSES = ['published', 'draft', 'scheduled', 'pending'];

function normalizeSlug(value) {
  return String(value || '').trim().slice(0, MAX_SLUG_LENGTH);
}

function count(sql, ...params) {
  return Number(db.prepare(sql).get(...params)?.total || 0);
}

/**
 * Clamps a requested reporting window to a whole number of days.
 *
 * The value arrives from a query string, so it can be a float, negative, zero
 * or nonsense. Rounding matters: a fractional span would ask SQLite for a
 * fractional day offset and produce a series whose length disagrees with the
 * period the dashboard says it is showing.
 */
function normalizeSpan(days) {
  const parsed = Math.floor(Number(days));
  if (!Number.isFinite(parsed) || parsed < 1) return 30;
  return Math.min(parsed, 365);
}

/* -------------------------------- writes --------------------------------- */

/**
 * Records one article read.
 *
 * Returns `{ counted }` so the caller can tell a fresh read from a repeat
 * visit that the unique-per-day rule collapsed. Unknown slugs are rejected:
 * without that check the endpoint is an open write for arbitrary strings.
 */
function recordView(slug, { voterId, viewerId } = {}) {
  const articleSlug = normalizeSlug(slug);
  if (!articleSlug) return { counted: false, reason: 'invalid-slug' };

  const known = db.prepare('SELECT 1 AS ok FROM articles WHERE slug = ?').get(articleSlug);
  if (!known) return { counted: false, reason: 'unknown-article' };

  // `voterId` is the name the engagement widgets already use for the anonymous
  // browser id; `viewerId` is accepted as a synonym for direct API callers.
  const viewer = String(voterId || viewerId || '').trim().slice(0, MAX_VIEWER_LENGTH);
  try {
    const info = db
      .prepare('INSERT INTO article_views (article_slug, viewer_id) VALUES (?, ?)')
      .run(articleSlug, viewer);
    return { counted: info.changes > 0 };
  } catch (error) {
    // Unique-index collision: this viewer already read this article today.
    if (String(error.message || '').includes('UNIQUE')) {
      return { counted: false, reason: 'already-counted-today' };
    }
    throw error;
  }
}

/* -------------------------------- reads ---------------------------------- */

function statusBreakdown() {
  const rows = db.prepare('SELECT status, COUNT(*) AS total FROM articles GROUP BY status').all();
  const breakdown = Object.fromEntries(REPORTED_STATUSES.map((status) => [status, 0]));
  let other = 0;
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(breakdown, row.status)) {
      breakdown[row.status] = Number(row.total);
    } else {
      other += Number(row.total);
    }
  }
  return { ...breakdown, other };
}

/**
 * A day-by-day series with no gaps.
 *
 * SQL only returns days that have rows, so a quiet day would be missing
 * entirely and a line chart would join across it and imply activity that never
 * happened. Every day in the window is emitted, zero-filled.
 */
function dailySeries({ days = 30 } = {}) {
  const span = normalizeSpan(days);
  const since = `-${span - 1} days`;

  const viewRows = db.prepare(`
    SELECT viewed_on AS day, COUNT(*) AS total, COUNT(DISTINCT NULLIF(viewer_id, '')) AS readers
    FROM article_views WHERE viewed_on >= date('now', ?) GROUP BY viewed_on
  `).all(since);
  const commentRows = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS total
    FROM comments WHERE date(created_at) >= date('now', ?) GROUP BY day
  `).all(since);
  const reactionRows = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS total
    FROM reactions WHERE date(created_at) >= date('now', ?) GROUP BY day
  `).all(since);
  const publishedRows = db.prepare(`
    SELECT published_at AS day, COUNT(*) AS total
    FROM articles WHERE status = 'published' AND published_at >= date('now', ?) GROUP BY day
  `).all(since);

  const index = (rows, field = 'total') =>
    new Map(rows.map((row) => [row.day, Number(row[field])]));
  const views = index(viewRows);
  const readers = index(viewRows, 'readers');
  const comments = index(commentRows);
  const reactions = index(reactionRows);
  const published = index(publishedRows);

  const calendar = db.prepare(`
    WITH RECURSIVE day(value) AS (
      SELECT date('now', ?) UNION ALL
      SELECT date(value, '+1 day') FROM day WHERE value < date('now')
    ) SELECT value FROM day
  `).all(since);

  return calendar.map(({ value }) => ({
    date: value,
    views: views.get(value) || 0,
    readers: readers.get(value) || 0,
    comments: comments.get(value) || 0,
    reactions: reactions.get(value) || 0,
    published: published.get(value) || 0
  }));
}

/**
 * Current window vs the window immediately before it, so a headline metric can
 * show direction rather than a bare number. `change` is a percentage; null when
 * the previous window was empty (growth from zero has no meaningful percentage).
 */
function trends({ days = 30 } = {}) {
  const span = normalizeSpan(days);
  const current = `-${span - 1} days`;
  const previousStart = `-${span * 2 - 1} days`;
  const previousEnd = `-${span} days`;

  const windowed = (table, column) => ({
    current: count(
      `SELECT COUNT(*) AS total FROM ${table} WHERE date(${column}) >= date('now', ?)`,
      current
    ),
    previous: count(
      `SELECT COUNT(*) AS total FROM ${table} WHERE date(${column}) >= date('now', ?) AND date(${column}) <= date('now', ?)`,
      previousStart, previousEnd
    )
  });

  const build = ({ current: now, previous }) => ({
    current: now,
    previous,
    change: previous > 0 ? Number((((now - previous) / previous) * 100).toFixed(1)) : null
  });

  return {
    days: span,
    views: build(windowed('article_views', 'viewed_on')),
    comments: build(windowed('comments', 'created_at')),
    reactions: build(windowed('reactions', 'created_at')),
    published: build({
      current: count(
        "SELECT COUNT(*) AS total FROM articles WHERE status = 'published' AND published_at >= date('now', ?)",
        current
      ),
      previous: count(
        "SELECT COUNT(*) AS total FROM articles WHERE status = 'published' AND published_at >= date('now', ?) AND published_at <= date('now', ?)",
        previousStart, previousEnd
      )
    })
  };
}

/**
 * Articles that belong to no registered author entity.
 *
 * Deleting an author clears `author_slug` on their articles, and imported
 * content may never have been linked to one. Those articles still count in the
 * site totals, so without this row the per-author figures would not add up to
 * the headline numbers and the difference would be invisible.
 */
function unattributedRow() {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total_articles,
      COUNT(CASE WHEN status = 'published' THEN 1 END) AS published,
      COUNT(CASE WHEN status = 'draft'     THEN 1 END) AS drafts,
      COUNT(CASE WHEN status = 'pending'   THEN 1 END) AS pending,
      COUNT(CASE WHEN status = 'scheduled' THEN 1 END) AS scheduled
    FROM articles a
    WHERE a.author_slug = '' OR a.author_slug NOT IN (SELECT slug FROM authors)
  `).get();

  if (!row || Number(row.total_articles) === 0) return null;

  const engagementFor = (table) => Number(db.prepare(`
    SELECT COUNT(*) AS total FROM ${table} t
    JOIN articles a ON a.slug = t.article_slug
    WHERE a.author_slug = '' OR a.author_slug NOT IN (SELECT slug FROM authors)
  `).get()?.total || 0);

  return {
    id: null,
    slug: '',
    name: 'Unattributed',
    role: 'No author profile linked',
    image: '',
    imageAlt: '',
    registeredAt: null,
    unattributed: true,
    articles: Number(row.total_articles),
    published: Number(row.published),
    drafts: Number(row.drafts),
    pending: Number(row.pending),
    scheduled: Number(row.scheduled),
    views: engagementFor('article_views'),
    reactions: engagementFor('reactions'),
    comments: engagementFor('comments')
  };
}

/** Per-author productivity and the engagement their work earned. */
function authorLeaderboard() {
  const rows = db.prepare(`
    SELECT
      au.id, au.slug, au.name, au.role, au.image, au.image_alt, au.created_at,
      COUNT(DISTINCT ar.id) AS total_articles,
      COUNT(DISTINCT CASE WHEN ar.status = 'published' THEN ar.id END) AS published,
      COUNT(DISTINCT CASE WHEN ar.status = 'draft'     THEN ar.id END) AS drafts,
      COUNT(DISTINCT CASE WHEN ar.status = 'pending'   THEN ar.id END) AS pending,
      COUNT(DISTINCT CASE WHEN ar.status = 'scheduled' THEN ar.id END) AS scheduled,
      (SELECT COUNT(*) FROM article_views v
        JOIN articles a2 ON a2.slug = v.article_slug WHERE a2.author_slug = au.slug) AS views,
      (SELECT COUNT(*) FROM reactions r
        JOIN articles a3 ON a3.slug = r.article_slug WHERE a3.author_slug = au.slug) AS reactions,
      (SELECT COUNT(*) FROM comments c
        JOIN articles a4 ON a4.slug = c.article_slug WHERE a4.author_slug = au.slug) AS comments
    FROM authors au
    LEFT JOIN articles ar ON ar.author_slug = au.slug
    GROUP BY au.id
    ORDER BY published DESC, views DESC, au.name ASC
  `).all().map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    role: row.role,
    image: row.image,
    imageAlt: row.image_alt,
    registeredAt: row.created_at,
    unattributed: false,
    articles: Number(row.total_articles),
    published: Number(row.published),
    drafts: Number(row.drafts),
    pending: Number(row.pending),
    scheduled: Number(row.scheduled),
    views: Number(row.views),
    reactions: Number(row.reactions),
    comments: Number(row.comments)
  }));

  // Appended last so registered authors always lead the table.
  const orphans = unattributedRow();
  return orphans ? [...rows, orphans] : rows;
}

/** Best performing articles by counted reads. */
function topArticles({ limit = 8 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 50);
  return db.prepare(`
    SELECT a.slug, a.title, a.category, a.status, a.author, a.author_slug,
      (SELECT COUNT(*) FROM article_views v WHERE v.article_slug = a.slug) AS views,
      (SELECT COUNT(DISTINCT NULLIF(v.viewer_id, '')) FROM article_views v WHERE v.article_slug = a.slug) AS readers,
      (SELECT COUNT(*) FROM reactions r WHERE r.article_slug = a.slug AND r.type = 'like') AS likes,
      (SELECT COUNT(*) FROM reactions r WHERE r.article_slug = a.slug AND r.type = 'dislike') AS dislikes,
      (SELECT COUNT(*) FROM comments c WHERE c.article_slug = a.slug) AS comments
    FROM articles a
    ORDER BY views DESC, likes DESC, a.published_at DESC
    LIMIT ?
  `).all(cap).map((row) => ({
    slug: row.slug,
    title: row.title,
    category: row.category,
    status: row.status,
    author: row.author,
    authorSlug: row.author_slug,
    views: Number(row.views),
    readers: Number(row.readers),
    likes: Number(row.likes),
    dislikes: Number(row.dislikes),
    comments: Number(row.comments)
  }));
}

function categoryBreakdown() {
  return db.prepare(`
    SELECT a.category,
      COUNT(*) AS articles,
      (SELECT COUNT(*) FROM article_views v
        JOIN articles a2 ON a2.slug = v.article_slug WHERE a2.category = a.category) AS views
    FROM articles a GROUP BY a.category ORDER BY views DESC, articles DESC
  `).all().map((row) => ({
    category: row.category,
    articles: Number(row.articles),
    views: Number(row.views)
  }));
}

/** Newest editorial and reader events, merged into one reverse-chronological feed. */
function recentActivity({ limit = 12 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const events = [];

  db.prepare(`
    SELECT c.author, c.body, c.created_at, c.article_slug, a.title
    FROM comments c LEFT JOIN articles a ON a.slug = c.article_slug
    ORDER BY c.id DESC LIMIT ?
  `).all(cap).forEach((row) => events.push({
    type: 'comment',
    at: row.created_at,
    title: row.title || row.article_slug,
    slug: row.article_slug,
    detail: `${row.author} commented`,
    body: String(row.body || '').slice(0, 140)
  }));

  db.prepare(`
    SELECT r.type, r.created_at, r.article_slug, a.title
    FROM reactions r LEFT JOIN articles a ON a.slug = r.article_slug
    ORDER BY r.id DESC LIMIT ?
  `).all(cap).forEach((row) => events.push({
    type: row.type === 'like' ? 'like' : 'dislike',
    at: row.created_at,
    title: row.title || row.article_slug,
    slug: row.article_slug,
    detail: row.type === 'like' ? 'A reader liked this' : 'A reader disliked this'
  }));

  db.prepare(`
    SELECT slug, title, author, status, updated_at FROM articles
    ORDER BY datetime(updated_at) DESC LIMIT ?
  `).all(cap).forEach((row) => events.push({
    type: row.status === 'published' ? 'published' : 'article',
    at: row.updated_at,
    title: row.title,
    slug: row.slug,
    detail: `${row.author} - ${row.status}`
  }));

  return events
    .filter((event) => event.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, cap);
}

/** Everything the dashboard renders, in a single round trip. */
function overview({ days = 30 } = {}) {
  const statuses = statusBreakdown();
  const totalArticles = count('SELECT COUNT(*) AS total FROM articles');
  const likes = count("SELECT COUNT(*) AS total FROM reactions WHERE type = 'like'");
  const dislikes = count("SELECT COUNT(*) AS total FROM reactions WHERE type = 'dislike'");
  const views = count('SELECT COUNT(*) AS total FROM article_views');
  const readers = count("SELECT COUNT(DISTINCT viewer_id) AS total FROM article_views WHERE viewer_id != ''");

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      articles: totalArticles,
      published: statuses.published,
      // "Unpublished" is everything not live: drafts, scheduled, pending and
      // any legacy status. Shown as one figure so the two always add up to the
      // article total, with the individual statuses broken out below.
      unpublished: totalArticles - statuses.published,
      drafts: statuses.draft,
      scheduled: statuses.scheduled,
      pending: statuses.pending,
      otherStatus: statuses.other,
      authors: count('SELECT COUNT(*) AS total FROM authors'),
      views,
      readers,
      likes,
      dislikes,
      reactions: likes + dislikes,
      comments: count('SELECT COUNT(*) AS total FROM comments'),
      images: count('SELECT COUNT(*) AS total FROM images')
    },
    statuses,
    trends: trends({ days }),
    series: dailySeries({ days }),
    authors: authorLeaderboard(),
    topArticles: topArticles({ limit: 8 }),
    categories: categoryBreakdown(),
    activity: recentActivity({ limit: 12 })
  };
}

module.exports = {
  recordView,
  overview,
  statusBreakdown,
  dailySeries,
  trends,
  authorLeaderboard,
  topArticles,
  categoryBreakdown,
  recentActivity
};
