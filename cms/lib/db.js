'use strict';

/**
 * Database layer for the Sholynk CMS.
 *
 * The site is a static front-end with no previous build tooling, so the CMS
 * keeps the operational footprint tiny: it uses SQLite through Node's built-in
 * `node:sqlite` module. No native compilation, no external database server.
 * The schema below is a plain relational schema, so moving to Postgres later is
 * a matter of swapping this file's query implementations.
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
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT 'Technology',
    description   TEXT NOT NULL DEFAULT '',
    body          TEXT NOT NULL DEFAULT '',
    img           TEXT NOT NULL DEFAULT '',
    alt           TEXT NOT NULL DEFAULT '',
    author        TEXT NOT NULL DEFAULT 'Sholynk Editorial',
    published_at  TEXT NOT NULL DEFAULT (date('now')),
    reading_time  TEXT NOT NULL DEFAULT '5 min read',
    featured      INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'published',
    hero          INTEGER NOT NULL DEFAULT 0,
    hero_order    INTEGER,
    external_link TEXT,
    seo_title     TEXT,
    seo_description TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
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

  -- Reader engagement. Keyed by article slug rather than a foreign key to
  -- articles(id) on purpose: the legacy static page (article_01.html) needs
  -- reactions too, and a slug keeps the tables usable for any page.
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

  CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
  CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
  CREATE INDEX IF NOT EXISTS idx_reactions_slug ON reactions(article_slug);
  CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(article_slug, id);
  CREATE INDEX IF NOT EXISTS idx_comments_client ON comments(client_id);
`);

// Migration for databases created before the client_id column existed.
// client_id is a client-generated id per comment submission: it makes the
// write endpoint idempotent (a retried submission returns the original
// comment) and lets offline comments be synced without duplicating.
{
  const columns = db.prepare('PRAGMA table_info(comments)').all();
  if (!columns.some((column) => column.name === 'client_id')) {
    db.exec("ALTER TABLE comments ADD COLUMN client_id TEXT NOT NULL DEFAULT ''");
  }
}

module.exports = { db, DB_FILE, DATA_DIR };
