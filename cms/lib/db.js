'use strict';

/**
 * SQLite database and additive migrations for the Sholynk CMS.
 *
 * The database is a runtime mirror of the version-controlled content files.
 * Migrations are deliberately additive so an existing installation can be
 * upgraded without deleting articles, engagement data or uploaded media.
 */

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.CMS_DATA_DIR
  ? path.resolve(process.env.CMS_DATA_DIR)
  : path.join(__dirname, '..', 'data');

const DB_FILE = process.env.CMS_DB_FILE
  ? path.resolve(process.env.CMS_DB_FILE)
  : path.join(DATA_DIR, 'cms.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'Technology',
    description     TEXT NOT NULL DEFAULT '',
    body            TEXT NOT NULL DEFAULT '',
    img             TEXT NOT NULL DEFAULT '',
    alt             TEXT NOT NULL DEFAULT '',
    author          TEXT NOT NULL DEFAULT 'Sholynk Editorial',
    author_slug     TEXT NOT NULL DEFAULT '',
    published_at    TEXT NOT NULL DEFAULT (date('now')),
    reading_time    TEXT NOT NULL DEFAULT '5 min read',
    featured        INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'published',
    hero            INTEGER NOT NULL DEFAULT 0,
    hero_order      INTEGER,
    external_link   TEXT,
    seo_title       TEXT,
    seo_description TEXT,
    content_type    TEXT NOT NULL DEFAULT 'article',
    subcategory     TEXT NOT NULL DEFAULT '',
    tags_json       TEXT NOT NULL DEFAULT '[]',
    hook            TEXT NOT NULL DEFAULT '',
    direct_answer   TEXT NOT NULL DEFAULT '',
    key_takeaways_json TEXT NOT NULL DEFAULT '[]',
    faqs_json       TEXT NOT NULL DEFAULT '[]',
    related_slugs_json TEXT NOT NULL DEFAULT '[]',
    canonical_url   TEXT,
    scheduled_at    TEXT,
    review_notes    TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS images (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    filename     TEXT NOT NULL,
    url          TEXT NOT NULL,
    alt          TEXT NOT NULL DEFAULT '',
    mime_type    TEXT NOT NULL DEFAULT '',
    size_bytes   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS authors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    bio         TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT '',
    image       TEXT NOT NULL DEFAULT '',
    image_alt   TEXT NOT NULL DEFAULT '',
    profile_url TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS article_sources (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id   INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    publisher    TEXT NOT NULL DEFAULT '',
    author       TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL DEFAULT '',
    url          TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'journalism',
    doi          TEXT NOT NULL DEFAULT '',
    accessed_at  TEXT NOT NULL DEFAULT '',
    supports     TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS redirects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    old_slug   TEXT NOT NULL UNIQUE,
    new_slug   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    article_slug TEXT NOT NULL,
    voter_id     TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('like', 'dislike')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (article_slug, voter_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    article_slug TEXT NOT NULL,
    author       TEXT NOT NULL,
    body         TEXT NOT NULL,
    voter_id     TEXT NOT NULL DEFAULT '',
    client_id    TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  /*
   * Article reads.
   *
   * One row per counted read. viewer_id is the same anonymous browser id the
   * engagement widgets use, so "unique readers" can be derived without any
   * account system or personal data. A read is only counted once per viewer per
   * article per day (enforced by the unique index below) so a reader who
   * refreshes, or leaves a tab open, cannot inflate the number.
   */
  CREATE TABLE IF NOT EXISTS article_views (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    article_slug TEXT NOT NULL,
    viewer_id    TEXT NOT NULL DEFAULT '',
    viewed_on    TEXT NOT NULL DEFAULT (date('now')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
  CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
  CREATE INDEX IF NOT EXISTS idx_sources_article ON article_sources(article_id, id);
  CREATE INDEX IF NOT EXISTS idx_reactions_slug ON reactions(article_slug);
  CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(article_slug, id);
`);

/** Add a column to databases created by an older release. */
function addColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

addColumn('comments', 'client_id', "TEXT NOT NULL DEFAULT ''");
addColumn('articles', 'author_slug', "TEXT NOT NULL DEFAULT ''");
addColumn('articles', 'content_type', "TEXT NOT NULL DEFAULT 'article'");
addColumn('articles', 'subcategory', "TEXT NOT NULL DEFAULT ''");
addColumn('articles', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");
addColumn('articles', 'hook', "TEXT NOT NULL DEFAULT ''");
addColumn('articles', 'direct_answer', "TEXT NOT NULL DEFAULT ''");
addColumn('articles', 'key_takeaways_json', "TEXT NOT NULL DEFAULT '[]'");
addColumn('articles', 'faqs_json', "TEXT NOT NULL DEFAULT '[]'");
addColumn('articles', 'related_slugs_json', "TEXT NOT NULL DEFAULT '[]'");
addColumn('articles', 'canonical_url', 'TEXT');
addColumn('articles', 'scheduled_at', 'TEXT');
addColumn('articles', 'review_notes', "TEXT NOT NULL DEFAULT ''");
addColumn('articles', 'submitter_email', "TEXT NOT NULL DEFAULT ''");
addColumn('articles', 'submitted_at', 'TEXT');

db.exec(`CREATE TABLE IF NOT EXISTS submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id   INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  article_slug TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  author_name  TEXT NOT NULL DEFAULT '',
  submitter_email TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at  TEXT,
  notes        TEXT NOT NULL DEFAULT ''
);`);

db.exec('CREATE INDEX IF NOT EXISTS idx_comments_client ON comments(client_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_submissions_article ON submissions(article_id, id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_views_slug ON article_views(article_slug, viewed_on)');
db.exec('CREATE INDEX IF NOT EXISTS idx_views_day ON article_views(viewed_on)');
// One counted read per viewer, per article, per day. Anonymous reads (no viewer
// id, e.g. a browser blocking storage) are exempt so they are still tallied.
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_views_unique
  ON article_views(article_slug, viewer_id, viewed_on) WHERE viewer_id != ''`);

module.exports = { db, DB_FILE, DATA_DIR };
