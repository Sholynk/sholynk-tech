'use strict';

/**
 * Host-neutral contact and newsletter persistence.
 *
 * Both public forms write to the same SQLite database as the CMS, so they work
 * on any Node host with a durable CMS_DB_FILE path. Provider-specific form
 * processing is deliberately not required.
 */

const { db } = require('./db');

class FormValidationError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'FormValidationError';
    this.errors = errors;
    this.status = 400;
  }
}

function clean(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function rejectBot(payload = {}) {
  const trap = payload['bot-field'] ?? payload.website ?? payload.companyWebsite;
  return Boolean(String(trap || '').trim());
}

function subscribe(payload = {}) {
  if (rejectBot(payload)) return { accepted: true };

  const name = clean(payload.name, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const errors = [];
  if (!name) errors.push('Name is required');
  if (!validEmail(email)) errors.push('A valid email address is required');
  if (errors.length) throw new FormValidationError(errors);

  db.prepare(`
    INSERT INTO newsletter_subscribers (name, email)
    VALUES (?, ?)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      status = 'active',
      updated_at = datetime('now')
  `).run(name, email);

  return { accepted: true };
}

function addContactMessage(payload = {}) {
  if (rejectBot(payload)) return { accepted: true };

  const name = clean(payload.name, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const subject = clean(payload.subject, 200);
  const message = clean(payload.message, 5000);
  const errors = [];
  if (!name) errors.push('Name is required');
  if (!validEmail(email)) errors.push('A valid email address is required');
  if (!subject) errors.push('Subject is required');
  if (message.length < 10) errors.push('Message must be at least 10 characters');
  if (errors.length) throw new FormValidationError(errors);

  const result = db.prepare(`
    INSERT INTO contact_messages (name, email, subject, message)
    VALUES (?, ?, ?, ?)
  `).run(name, email, subject, message);

  return { accepted: true, id: Number(result.lastInsertRowid) };
}

function listSubscribers() {
  return db.prepare(`
    SELECT id, name, email, status, created_at AS createdAt, updated_at AS updatedAt
    FROM newsletter_subscribers
    ORDER BY id DESC
  `).all();
}

function listContactMessages() {
  return db.prepare(`
    SELECT id, name, email, subject, message, status, created_at AS createdAt
    FROM contact_messages
    ORDER BY id DESC
  `).all();
}

function removeSubscriber(id) {
  return db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(Number(id)).changes > 0;
}

function removeContactMessage(id) {
  return db.prepare('DELETE FROM contact_messages WHERE id = ?').run(Number(id)).changes > 0;
}

module.exports = {
  FormValidationError,
  subscribe,
  addContactMessage,
  listSubscribers,
  listContactMessages,
  removeSubscriber,
  removeContactMessage
};
