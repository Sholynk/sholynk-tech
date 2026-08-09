'use strict';

/**
 * Minimal front-matter parser for Markdown article files.
 *
 * Long-form articles in `article_stories/*.md` carry their metadata in a
 * small header block at the top of the file:
 *
 *   ---
 *   title: The Rise of Quantum Computing
 *   slug: the-rise-of-quantum-computing
 *   category: Technology
 *   description: ...
 *   img: article-images/quantum/quantum-computer-chandelier.jpg
 *   alt: ...
 *   date: 2026-08-02
 *   readingTime: 12 min read
 *   featured: true
 *   hero: true
 *   heroOrder: 1
 *   seoTitle: ...
 *   seoDescription: ...
 *   author: Busari Oluwashola
 *   ---
 *
 * Values are single-line strings; `true`/`false` become booleans and bare
 * integers become numbers. Everything after the closing `---` is the article
 * body. Files without a front-matter block are returned unchanged.
 */

function parseFrontMatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { data: {}, body: source };

  const data = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf(':');
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (!key) continue;

    if (/^(true|false)$/i.test(value)) value = value.toLowerCase() === 'true';
    else if (/^-?\d+$/.test(value)) value = Number(value);
    else value = value.replace(/^["']|["']$/g, '');

    data[key] = value;
  }

  return { data, body: source.slice(match[0].length) };
}

module.exports = { parseFrontMatter };
