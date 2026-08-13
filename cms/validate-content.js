'use strict';

/** Editorial and build-time validation for version-controlled Markdown. */

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontMatter } = require('./lib/frontmatter');
const { slugify, VALID_CONTENT_TYPES, VALID_STATUS, VALID_SOURCE_TYPES } = require('./lib/articles');

const ROOT = path.join(__dirname, '..');
const STORIES_DIR = path.join(ROOT, 'article_stories');

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateStory(file, slugs) {
  const errors = [];
  const warnings = [];
  const raw = fs.readFileSync(file, 'utf8');
  const { data, body } = parseFrontMatter(raw);
  const label = path.relative(ROOT, file);

  if (!Object.keys(data).length) return { errors, warnings, skipped: true };
  for (const key of ['title', 'slug', 'category', 'description', 'img', 'alt', 'date', 'author']) {
    if (!String(data[key] || '').trim()) errors.push(`${label}: ${key} is required`);
  }
  if ((data.status || 'published') === 'published' && body.trim().split(/\s+/).filter(Boolean).length < 300) {
    errors.push(`${label}: published long-form content must contain at least 300 words`);
  }

  const slug = slugify(data.slug || data.title);
  if (slugs.has(slug)) errors.push(`${label}: duplicate slug "${slug}"`);
  slugs.add(slug);
  if (data.slug !== slug) errors.push(`${label}: slug must be lowercase words separated by hyphens`);
  if (data.authorSlug && slugify(data.authorSlug) !== data.authorSlug) {
    errors.push(`${label}: authorSlug must be a lowercase hyphenated slug`);
  }

  if (data.status && !VALID_STATUS.has(data.status)) {
    errors.push(`${label}: unsupported status "${data.status}"`);
  }
  if (data.contentType && !VALID_CONTENT_TYPES.has(data.contentType)) {
    errors.push(`${label}: unsupported contentType "${data.contentType}"`);
  }
  if ((data.status || 'published') === 'scheduled' && !data.scheduledAt) {
    errors.push(`${label}: scheduledAt is required when status is scheduled`);
  }
  if (data.scheduledAt && Number.isNaN(new Date(data.scheduledAt).valueOf())) {
    errors.push(`${label}: scheduledAt must be a valid date and time`);
  }
  if (Number.isNaN(new Date(data.date).valueOf())) errors.push(`${label}: date must be a valid date`);

  if (data.img) {
    const image = path.resolve(ROOT, data.img);
    if (!image.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(image)) {
      errors.push(`${label}: image does not exist: ${data.img}`);
    }
  }

  for (const match of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1];
    if (/^https?:\/\//i.test(target)) continue;
    const image = path.resolve(ROOT, target);
    if (!image.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(image)) {
      errors.push(`${label}: Markdown image does not exist: ${target}`);
    }
  }

  for (const key of ['tags', 'keyTakeaways', 'relatedSlugs', 'faqs', 'sources']) {
    if (data[key] != null && !Array.isArray(data[key])) errors.push(`${label}: ${key} must be a JSON array`);
  }
  for (const key of ['tags', 'keyTakeaways']) {
    if (Array.isArray(data[key]) && data[key].some((item) => !String(item || '').trim())) {
      errors.push(`${label}: ${key} cannot contain empty values`);
    }
  }
  for (const relatedSlug of Array.isArray(data.relatedSlugs) ? data.relatedSlugs : []) {
    if (slugify(relatedSlug) !== relatedSlug) {
      errors.push(`${label}: relatedSlugs must contain lowercase hyphenated slugs`);
    }
  }
  for (const faq of Array.isArray(data.faqs) ? data.faqs : []) {
    if (!String(faq?.question || '').trim() || !String(faq?.answer || '').trim()) {
      errors.push(`${label}: every FAQ needs a question and answer`);
    }
  }
  for (const source of Array.isArray(data.sources) ? data.sources : []) {
    if (!String(source?.title || '').trim()) errors.push(`${label}: every source needs a title`);
    if (!isHttpUrl(source?.url)) errors.push(`${label}: every source needs an absolute HTTP(S) URL`);
    if (source?.type && !VALID_SOURCE_TYPES.has(source.type)) {
      errors.push(`${label}: unsupported source type "${source.type}"`);
    }
  }
  if (data.canonicalUrl && (!isHttpUrl(data.canonicalUrl) || !String(data.canonicalUrl).startsWith('https://'))) {
    errors.push(`${label}: canonicalUrl must be an absolute HTTPS URL`);
  }

  const seoTitle = String(data.seoTitle || data.title || '');
  const seoDescription = String(data.seoDescription || data.description || '');
  if (seoTitle.length > 70) warnings.push(`${label}: SEO title is ${seoTitle.length} characters (recommended maximum: 70)`);
  if (seoDescription.length > 170) warnings.push(`${label}: SEO description is ${seoDescription.length} characters (recommended maximum: 170)`);
  if (!(data.sources || []).length) {
    warnings.push(`${label}: no claim sources are recorded; add only verified sources, never placeholders`);
  }
  return { errors, warnings, skipped: false };
}

function run() {
  const slugs = new Set();
  const allErrors = [];
  const allWarnings = [];
  let count = 0;
  const files = fs.readdirSync(STORIES_DIR)
    .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
    .sort();
  for (const name of files) {
    const result = validateStory(path.join(STORIES_DIR, name), slugs);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
    if (!result.skipped) count += 1;
  }

  allWarnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  if (allErrors.length) {
    allErrors.forEach((error) => console.error(`Error: ${error}`));
    throw new Error(`Content validation failed with ${allErrors.length} error(s).`);
  }
  console.log(`Validated ${count} Markdown articles (${allWarnings.length} advisory warning(s)).`);
  return { count, warnings: allWarnings };
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { run, validateStory };
