'use strict';

/**
 * Editorial review notification delivery.
 *
 * Out of the box we do not require SMTP credentials: if SMTP_* environment
 * variables are configured we send a real email to the editor address
 * (SHOLYNK_EDITOR_EMAIL, default sholynktech@gmail.com). Otherwise we log
 * the notification to the server console and to a small on-disk queue so
 * nothing is lost while running locally or on a host without mail.
 *
 * Configure real delivery by setting these environment variables:
 *   SHOLYNK_EDITOR_EMAIL   destination address (default: sholynktech@gmail.com)
 *   SMTP_HOST              e.g. smtp.gmail.com
 *   SMTP_PORT              e.g. 465 (SSL) or 587 (STARTTLS)
 *   SMTP_SECURE            "true" for port 465, "false" otherwise
 *   SMTP_USER              SMTP login
 *   SMTP_PASS              SMTP password / app password
 *   SMTP_FROM              envelope "From" address (defaults to SMTP_USER)
 *   SITE_BASE_URL          public URL of the deployed site, used for links
 */

const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR } = require('./db');

const EDITOR_EMAIL = process.env.SHOLYNK_EDITOR_EMAIL || 'sholynktech@gmail.com';
const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || `Sholynk CMS <${EDITOR_EMAIL}>`;
const BASE_URL = process.env.SITE_BASE_URL || process.env.URL || `http://localhost:${process.env.PORT || 3000}`;
const QUEUE_FILE = path.join(DATA_DIR, 'notifications.log');

function escapeHeader(value) {
  return String(value).replace(/[\r\n]+/g, ' ').slice(0, 900);
}

function buildText(article) {
  const adminUrl = `${BASE_URL.replace(/\/$/, '')}/admin/`;
  const previewPath = article.externalLink
    || (article.body ? `/articles/${encodeURIComponent(article.slug)}/` : `/article.html?slug=${encodeURIComponent(article.slug)}`);
  const previewUrl = new URL(previewPath, BASE_URL).href;
  return [
    'A new article has been submitted for review on Sholynk Tech.',
    '',
    `Title:        ${article.title}`,
    `Author:       ${article.author}${article.authorSlug ? ` (${article.authorSlug})` : ''}`,
    `Category:     ${article.category}${article.subcategory ? ' / ' + article.subcategory : ''}`,
    `Status:       ${article.status}`,
    `Slug:         ${article.slug}`,
    `Submitter:    ${article.submitterEmail || '(not provided)'}`,
    `Word count:   ~${String(article.body || '').split(/\s+/).filter(Boolean).length} words`,
    `Tags:         ${(article.tags || []).join(', ') || '(none)'}`,
    '',
    'Description:',
    article.description || '(no description provided)',
    '',
    `Open admin dashboard: ${adminUrl}`,
    `Preview article:      ${previewUrl}`,
    '',
    'This message was generated automatically by the Sholynk CMS.'
  ].join('\n');
}

function buildHtml(article) {
  const adminUrl = `${BASE_URL.replace(/\/$/, '')}/admin/`;
  const previewPath = article.externalLink
    || (article.body ? `/articles/${encodeURIComponent(article.slug)}/` : `/article.html?slug=${encodeURIComponent(article.slug)}`);
  const previewUrl = new URL(previewPath, BASE_URL).href;
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#101828;max-width:640px;margin:0 auto;">
    <h1 style="color:#0b86d8;">New article submitted for review</h1>
    <p><strong>${esc(article.title)}</strong></p>
    <table style="border-collapse:collapse;margin:1rem 0;font-size:0.9rem;">
      <tr><td style="padding:0.3rem 1rem 0.3rem 0;color:#667085;">Author</td><td>${esc(article.author)}</td></tr>
      <tr><td style="padding:0.3rem 1rem 0.3rem 0;color:#667085;">Category</td><td>${esc(article.category)}${article.subcategory ? ' / ' + esc(article.subcategory) : ''}</td></tr>
      <tr><td style="padding:0.3rem 1rem 0.3rem 0;color:#667085;">Slug</td><td>${esc(article.slug)}</td></tr>
      <tr><td style="padding:0.3rem 1rem 0.3rem 0;color:#667085;">Submitter</td><td>${esc(article.submitterEmail || '(not provided)')}</td></tr>
      <tr><td style="padding:0.3rem 1rem 0.3rem 0;color:#667085;">Tags</td><td>${esc((article.tags || []).join(', ') || '(none)')}</td></tr>
    </table>
    <p style="color:#344054;">${esc(article.description || 'No description provided.')}</p>
    <p>
      <a href="${esc(adminUrl)}" style="display:inline-block;padding:0.7rem 1.1rem;background:#0b86d8;color:#fff;border-radius:0.5rem;text-decoration:none;margin-right:0.6rem;">Open CMS admin</a>
      <a href="${esc(previewUrl)}" style="display:inline-block;padding:0.7rem 1.1rem;border:1px solid #dfe5ec;color:#0b86d8;border-radius:0.5rem;text-decoration:none;">Preview article</a>
    </p>
    <p style="color:#98a2b3;font-size:0.75rem;">Automated message from Sholynk CMS.</p>
  </body></html>`;
}

function logFallback(article, reason) {
  const entry = {
    at: new Date().toISOString(),
    reason,
    to: EDITOR_EMAIL,
    title: article.title,
    slug: article.slug,
    author: article.author,
    submitterEmail: article.submitterEmail
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(QUEUE_FILE, `${JSON.stringify(entry)}\n`);
  console.log(`[notifications] Would email ${EDITOR_EMAIL} about "${article.title}" (${reason}). Logged to ${path.relative(process.cwd(), QUEUE_FILE)}.`);
}

async function sendViaSmtp(article) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined
  });
  await transporter.sendMail({
    from: FROM_EMAIL,
    to: EDITOR_EMAIL,
    replyTo: article.submitterEmail || undefined,
    subject: escapeHeader(`[Sholynk Review] ${article.title}`),
    text: buildText(article),
    html: buildHtml(article)
  });
}

async function notifyReviewNeeded(article) {
  if (!article) return false;
  if (!process.env.SMTP_HOST) {
    logFallback(article, 'SMTP_HOST not configured');
    return false;
  }
  try {
    await sendViaSmtp(article);
    console.log(`[notifications] Review notification sent to ${EDITOR_EMAIL} for "${article.title}".`);
    return true;
  } catch (error) {
    console.error('[notifications] SMTP send failed; falling back to log.', error);
    logFallback(article, `SMTP error: ${error.message}`);
    return false;
  }
}

module.exports = { notifyReviewNeeded, EDITOR_EMAIL, buildText, buildHtml };
