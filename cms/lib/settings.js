'use strict';

const { db } = require('./db');

// Migration defaults are inserted into SQLite once. Public reads then return
// database rows only; this object is not a browser/server content fallback.
const DEFAULTS = {
  siteTitle: 'Sholynk Technology - AI, Web3 and Emerging Tech Insights',
  siteDescription:
    'Explore editor picks, practical guides and analysis on AI trends, Web3, software development, cybersecurity and emerging technology.',
  siteKeywords: 'technology, AI trends, Web3, software development, cybersecurity, articles',
  homeTagline: 'Insightful tech stories for builders, creators and curious minds.'
};

function ensureDefaults() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULTS)) insert.run(key, value);
}

function all() {
  ensureDefaults();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function set(patch = {}) {
  ensureDefaults();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue;
    stmt.run(String(key), String(value));
  }
  return all();
}

ensureDefaults();

module.exports = { all, set, ensureDefaults, DEFAULTS };
