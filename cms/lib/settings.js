'use strict';

const { db } = require('./db');

const DEFAULTS = {
  siteTitle: 'Sholynk Technology - AI, Web3 and Emerging Tech Insights',
  siteDescription:
    'Explore editor picks, practical guides and analysis on AI trends, Web3, software development, cybersecurity and emerging technology.',
  siteKeywords: 'technology, AI trends, Web3, software development, cybersecurity, articles',
  heroEyebrow: 'Sholynk Technology',
  homeTagline: 'Insightful tech stories for builders, creators and curious minds.'
};

function all() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...DEFAULTS, ...stored };
}

function set(patch = {}) {
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

module.exports = { all, set, DEFAULTS };
