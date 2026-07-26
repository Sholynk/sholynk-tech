'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { db } = require('./db');

const UPLOAD_DIR = process.env.CMS_UPLOAD_DIR
  ? path.resolve(process.env.CMS_UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function toApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    filename: row.filename,
    url: row.url,
    alt: row.alt,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at
  };
}

function list() {
  return db.prepare('SELECT * FROM images ORDER BY id DESC').all().map(toApi);
}

function getById(id) {
  return toApi(db.prepare('SELECT * FROM images WHERE id = ?').get(Number(id)));
}

function create({ filename, alt = '', mimeType = '', sizeBytes = 0 }) {
  const url = `/uploads/${filename}`;
  const info = db.prepare(
    'INSERT INTO images (filename, url, alt, mime_type, size_bytes) VALUES (?,?,?,?,?)'
  ).run(filename, url, String(alt), String(mimeType), Number(sizeBytes) || 0);
  return getById(info.lastInsertRowid);
}

function updateAlt(id, alt) {
  const existing = getById(id);
  if (!existing) return null;
  db.prepare('UPDATE images SET alt = ? WHERE id = ?').run(String(alt ?? ''), existing.id);
  return getById(existing.id);
}

function remove(id) {
  const existing = getById(id);
  if (!existing) return false;
  db.prepare('DELETE FROM images WHERE id = ?').run(existing.id);
  const filePath = path.join(UPLOAD_DIR, path.basename(existing.filename));
  fs.rm(filePath, { force: true }, () => {});
  return true;
}

module.exports = { list, getById, create, updateAlt, remove, UPLOAD_DIR };
