'use strict';

/**
 * Lightweight PDF -> article-draft extractor.
 *
 * The goal is NOT to perfectly recreate a Word/Pages manuscript — that is an
 * AI problem — but to save the author most of the copy/paste grunt work:
 *   * pull out the likely title (largest/first short line),
 *   * convert the body into plain text wrapped in Markdown-ish paragraphs,
 *   * pick a teaser / description from the first content paragraph,
 *   * estimate a list of keyword tags,
 *   * and return the whole payload in the shape the article form expects.
 *
 * Authors still edit the result in the CMS before saving. The quality bar is
 * "good first draft", not "publish-ready".
 */

const fs = require('node:fs');

let PDFParseCtor = null;
function getPdfCtor() {
  if (PDFParseCtor) return PDFParseCtor;
  // pdf-parse v2 exposes a PDFParse class that accepts either a URL or a
  // Uint8Array buffer (or a local file path in Node).
  // eslint-disable-next-line global-require
  PDFParseCtor = require('pdf-parse').PDFParse;
  return PDFParseCtor;
}

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','of','at','by','for','with','about',
  'to','in','on','from','as','is','are','was','were','be','been','being','this',
  'that','these','those','it','its','into','onto','than','so','such','not','no',
  'yes','also','just','only','over','under','more','most','less','least','can',
  'will','would','should','could','may','might','must','shall','do','does','did',
  'have','has','had','having','i','you','he','she','we','they','them','their',
  'our','your','his','her','my','me','him','us','what','which','who','whom',
  'when','where','why','how','all','any','some','each','every','other','another',
  'because','while','although','though','after','before','during','between'
]);

const CATEGORY_KEYWORDS = {
  'AI Trends': ['ai','artificial','intelligence','machine','learning','llm','gpt','neural','model','chatgpt','openai','generative'],
  Technology: ['software','engineering','developer','programming','javascript','python','cloud','saas','api','hardware','startup'],
  Cryptocurrency: ['bitcoin','crypto','cryptocurrency','ethereum','blockchain','token','defi','nft','wallet','mining','solana'],
  'Web 3': ['web3','decentralized','dao','smart contract','solidity','dapp','metamask','ipfs'],
  Game: ['game','gaming','esports','playstation','xbox','nintendo','steam','gamer','vr','metaverse']
};

function normalizeText(raw) {
  return String(raw || '')
    .replace(/\r/g, '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    // Strip common page-footer lines pdf-parse returns ("-- 1 of 5 --").
    .replace(/^\s*--\s*\d+\s*of\s*\d+\s*--\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n');
}

function isBylinish(line) {
  const t = line.trim();
  return /^(?:by|written by|author[: ])/i.test(t)
    || /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(t)
    || /^https?:\/\//i.test(t);
}

function isHeaderLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isBylinish(trimmed)) return false;
  if (trimmed.length > 110) return false;
  // All-uppercase short lines are usually a title or section heading.
  if (trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed) && trimmed.length < 80) return true;
  // Title / section case: starts with a letter or digit, letters/digits/common
  // punctuation, not ending in a sentence period, 2-10 words. We don't require
  // the first character to be uppercase so numbered sections ("1. Introduction")
  // still match, and we allow apostrophes/quotes that real headings use.
  if (/^[A-Za-z0-9][A-Za-z0-9&,:'"+\-()\s]{1,100}$/.test(trimmed)) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 10 && !/[.!?]$/.test(trimmed)) return true;
  }
  return false;
}

function scoreTitle(candidates) {
  // Prefer a line near the top of the document that is short, has word-case,
  // and doesn't look like a byline/date/contact block.
  return candidates
    .map((text, index) => {
      const words = text.split(/\s+/).filter(Boolean);
      let score = 0;
      if (words.length >= 3 && words.length <= 18) score += 10;
      if (index < 3) score += 8;
      if (index < 8) score += 4;
      if (isBylinish(text) || /\d{1,2}\/\d{1,2}/.test(text)) score -= 20;
      if (text === text.toUpperCase()) score += 2;
      if (/^[\d\W]+$/.test(text)) score -= 10;
      return { text, score, index };
    })
    .sort((a, b) => b.score - a.score);
}

function pickTitle(lines) {
  const head = lines.slice(0, 25).map((l) => l.trim()).filter((l) => l && !isBylinish(l));
  if (!head.length) return 'Untitled draft';
  const ranked = scoreTitle(head);
  return (ranked[0]?.text || head[0]).slice(0, 160);
}

function pickDescription(paragraphs, title) {
  const bodyParagraphs = paragraphs.filter((p) => {
    const t = p.trim();
    if (!t) return false;
    if (t === title) return false;
    if (isBylinish(t)) return false;
    if (t.length < 60) return false;
    if (/^(abstract[: ]|keywords[: ])/i.test(t)) return false;
    // Skip page-footers inserted by PDF generators.
    if (/^--\s*\d+\s*of\s*\d+\s*--$/i.test(t)) return false;
    return true;
  });
  return (bodyParagraphs[0] || '').trim().slice(0, 300);
}

function textToMarkdown(text, title) {
  const lines = text.split('\n');
  const out = [];
  let afterTitle = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    if (!afterTitle && line === title) {
      afterTitle = true;
      out.push(`# ${line}`);
      out.push('');
      continue;
    }
    if (!afterTitle && isBylinish(line)) continue;
    if (afterTitle && out.length <= 4 && isBylinish(line)) continue;
    // "Abstract:" / "Keywords:" style front-matter lines
    if (/^abstract[:\s]/i.test(line)) {
      out.push(`> ${line.replace(/^abstract[:\s]*/i, '')}`);
      out.push('');
      continue;
    }
    if (/^keywords?[:\s]/i.test(line)) {
      out.push(`<!-- Keywords: ${line.replace(/^keywords?[:\s]*/i, '')} -->`);
      out.push('');
      continue;
    }
    // Likely section heading
    if (isHeaderLine(line) && line !== title && line.split(/\s+/).length <= 10) {
      out.push(`## ${line.replace(/[:]+$/, '')}`);
      out.push('');
      continue;
    }
    // Bullets that started with a dash or bullet char
    if (/^[-*•·]\s+/.test(line)) {
      out.push(`- ${line.replace(/^[-*•·]\s+/, '')}`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      out.push(`- ${line.replace(/^\d+[.)]\s+/, '')}`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function suggestTags(text) {
  const words = String(text).toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  const freq = new Map();
  for (const word of words) {
    if (STOPWORDS.has(word)) continue;
    if (/^\d+$/.test(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  // Lift multi-word tech terms (bigrams) that recur.
  const tokens = words.filter((w) => !STOPWORDS.has(w));
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (/(ai|machine|web|crypto|blockchain|neural|openai|large language|software)/i.test(bigram)) {
      freq.set(bigram, (freq.get(bigram) || 0) + 2);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term]) => term)
    .filter((t, i, arr) => arr.indexOf(t) === i);
}

function guessCategory(text) {
  const lower = text.toLowerCase();
  let best = 'Technology';
  let bestScore = 0;
  for (const [category, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = kws.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }
  return best;
}

async function extractPdfDraft(filePath) {
  const PDFParse = getPdfCtor();
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const text = normalizeText(result.text || '');
  const lines = text.split('\n').map((l) => l.trim());
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim());
  const title = pickTitle(lines);
  const description = pickDescription(paragraphs, title);
  const body = textToMarkdown(text, title);
  const tagPool = suggestTags(text);
  // Trim tags to a manageable handful; author can curate.
  const tags = tagPool.slice(0, 6);
  const category = guessCategory(text);

  const wordCount = (text.match(/\S+/g) || []).length;
  const readingTime = `${Math.max(1, Math.round(wordCount / 200))} min read`;

  const info = {};
  try {
    const infoResult = await parser.getInfo?.();
    if (infoResult) Object.assign(info, infoResult.info || infoResult);
  } catch {
    // Metadata is optional; ignore failures.
  }

  return {
    title,
    description,
    hook: description.slice(0, 160),
    body,
    tags,
    category,
    readingTime,
    contentType: 'article',
    meta: {
      pages: result.pages || result.numpages || null,
      info,
      wordCount
    }
  };
}

module.exports = { extractPdfDraft };
