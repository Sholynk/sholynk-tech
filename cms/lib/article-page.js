'use strict';

/**
 * Server-side article page renderer.
 *
 * Every call receives current SQLite records and produces the response for one
 * clean article URL. Nothing is written to disk and no exported content copy is
 * read, so the database remains the sole public runtime content source.
 */

const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', '..');
const SHELL_FILE = path.join(ROOT, 'article.html');

function siteUrl(pathname = '/', origin) {
  const relative = `/${String(pathname).replace(/^\/+/, '')}`;
  return new URL(relative, `${origin}/`).href;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(value = '', origin) {
  if (/^https?:\/\//i.test(value)) return value;
  const reference = String(value).trim();
  const parsed = new URL(reference.replace(/^\/+/, ''), 'https://site.invalid/');
  const relative = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return new URL(relative, `${origin}/`).href;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function headingSlug(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section';
}

/**
 * Clean article URLs live at <site>/articles/<slug>/, two path segments below
 * the site root. Local links therefore use "../../" so browser navigation and
 * assets resolve correctly without assuming a particular hostname.
 */
const SITE_ROOT_PREFIX = '../../';

function articlePageUrl(value = '') {
  const reference = String(value).trim();
  if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(reference)) {
    return reference;
  }

  try {
    const parsed = new URL(reference, 'https://article-content.invalid/');
    const pathname = parsed.pathname.replace(/^\/+/, '');
    return `${SITE_ROOT_PREFIX}${pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    return reference;
  }
}

/**
 * Intrinsic pixel dimensions for a local image, cached for the process.
 *
 * Returns null for remote images and anything sharp cannot read, in which case
 * the caller simply omits the attributes.
 */
const imageSizeCache = new Map();

async function intrinsicSize(src = '') {
  const reference = String(src).trim();
  if (!reference || /^(?:https?:|data:|\/\/)/i.test(reference)) return null;
  if (imageSizeCache.has(reference)) return imageSizeCache.get(reference);

  // Markdown authors write paths relative to the site root, sometimes
  // URL-encoded (e.g. "Article%20cards%20images/...").
  let relative = reference.split(/[?#]/, 1)[0].replace(/^(?:(?:\.\.?)\/)+/, '').replace(/^\/+/, '');
  try {
    relative = decodeURIComponent(relative);
  } catch (error) {
    // Malformed escape sequence: fall back to the raw path.
  }

  const input = path.resolve(ROOT, relative);
  let size = null;
  if (input.startsWith(`${ROOT}${path.sep}`) && fs.existsSync(input)) {
    try {
      const metadata = await sharp(input).metadata();
      if (metadata.width && metadata.height) {
        size = { width: metadata.width, height: metadata.height };
      }
    } catch (error) {
      size = null;
    }
  }
  imageSizeCache.set(reference, size);
  return size;
}

/**
 * Stamp intrinsic width/height onto every body image that lacks them.
 *
 * Without these attributes an image occupies zero height until it decodes, so
 * the page reflows as each one arrives. That shifts every heading below it and
 * is what made in-page navigation land past the section it aimed at. Declaring
 * the real dimensions lets the browser reserve the space up front, so the
 * layout is stable from first paint and anchors resolve correctly even with
 * JavaScript disabled.
 */
async function addIntrinsicImageSizes(html = '') {
  const tags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const unique = [...new Set(tags)];
  const replacements = new Map();

  for (const tag of unique) {
    if (/\bwidth\s*=/i.test(tag) && /\bheight\s*=/i.test(tag)) continue;
    const src = tag.match(/\bsrc\s*=\s*"([^"]*)"/i)?.[1];
    if (!src) continue;
    const size = await intrinsicSize(src);
    if (!size) continue;
    replacements.set(
      tag,
      tag.replace(/\s*\/?>$/, ` width="${size.width}" height="${size.height}" />`)
    );
  }

  if (!replacements.size) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => replacements.get(tag) || tag);
}

function renderMarkdown(markdown = '') {
  const raw = marked.parse(markdown, { gfm: true });
  const usedIds = new Set();
  let html = raw.replace(/<h2>([\s\S]*?)<\/h2>/g, (match, contents) => {
    const base = headingSlug(contents);
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return `<h2 id="${id}">${contents}</h2>`;
  });

  html = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption']),
    allowedAttributes: {
      '*': ['id', 'class'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      code: ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a(tagName, attribs) {
        const href = articlePageUrl(attribs.href || '');
        const localised = href ? { ...attribs, href } : attribs;
        const external = /^(?:https?:)?\/\//i.test(href);
        return {
          tagName,
          attribs: external
            ? { ...localised, target: '_blank', rel: 'noopener noreferrer' }
            : localised
        };
      },
      img(tagName, attribs) {
        let src = attribs.src || '';
        if (src && !/^(?:https?:|data:|\/\/)/i.test(src)) src = articlePageUrl(src);
        return {
          tagName,
          attribs: { ...attribs, src, alt: attribs.alt || '', loading: 'lazy', decoding: 'async' }
        };
      }
    }
  });
  return html;
}

function renderToc(bodyHtml) {
  const headings = [...bodyHtml.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  if (headings.length < 3) return '';
  const items = headings.map((heading, index) => (
    `<li><a href="#${escapeHtml(heading[1])}"${index === 0 ? ' aria-current="location"' : ''}><span>${escapeHtml(heading[2].replace(/<[^>]*>/g, ''))}</span></a></li>`
  )).join('');
  return `<details class="article-toc" open><summary><span><small>Navigate</small>In this article</span><i class="fas fa-chevron-down" aria-hidden="true"></i></summary><nav aria-label="Table of contents"><ol>${items}</ol></nav></details>`;
}

function renderAuthorCard(author, variant = 'rail') {
  if (!author) return '';
  const hasImage = Boolean(author.image);
  const initials = (author.name || 'A')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
  const media = hasImage
    ? `<div class="article-author-media"><img src="${escapeHtml(/^https?:\/\//i.test(author.image) ? author.image : articlePageUrl(author.image))}" alt="${escapeHtml(author.imageAlt || `Photo of ${author.name}`)}" loading="lazy" decoding="async"/></div>`
    : `<div class="article-author-media"><div class="article-author-avatar" aria-hidden="true">${escapeHtml(initials || 'A')}</div></div>`;
  // The role line is deliberately not rendered: the bio already states what the
  // author does, so printing both repeats the same sentence twice on the card.
  // `role` is still stored and still feeds schema.org jobTitle and the admin list.
  const role = '';
  const bio = author.bio ? `<p class="article-author-bio">${escapeHtml(author.bio)}</p>` : '';
  const link = author.profileUrl
    ? `<a class="article-author-link" href="${escapeHtml(author.profileUrl)}" target="_blank" rel="noopener noreferrer">View full profile <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
    : '';
  const classes = ['article-author-card', `article-author-card--${variant}`].join(' ');
  return `<aside class="${classes}" aria-label="About ${escapeHtml(author.name || 'the author')}">${media}<div class="article-author-body"><p class="eyebrow">Written by</p><h3>${escapeHtml(author.name || 'Sholynk Editorial')}</h3>${role}${bio}${link}</div></aside>`;
}

/**
 * The shared presentation shell lives at the site root. A clean article route
 * is two URL segments deeper, so local assets, navigation and form actions are
 * rewritten to point back to the application root.
 */
function localiseShell(shell) {
  return shell.replace(/\b(href|src|action)="([^"]+)"/g, (match, attribute, value) => {
    if (/^(?:https?:|mailto:|tel:|data:|#|\/)/i.test(value)) return match;
    return `${attribute}="${SITE_ROOT_PREFIX}${value}"`;
  });
}

function renderList(items, className) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderFaqs(faqs) {
  if (!Array.isArray(faqs) || !faqs.length) return '';
  return `<section class="article-faq" aria-labelledby="faq-heading"><h2 id="faq-heading">Frequently asked questions</h2>${faqs.map((faq) => (
    `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`
  )).join('')}</section>`;
}

function renderSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return '';
  return `<section class="article-sources" aria-labelledby="sources-heading"><h2 id="sources-heading">Sources</h2><ol>${sources.map((source) => {
    const details = [source.author, source.publisher, source.publishedAt].filter(Boolean).map(escapeHtml).join(', ');
    return `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>${details ? ` — ${details}` : ''}${source.supports ? `<span>Supports: ${escapeHtml(source.supports)}</span>` : ''}</li>`;
  }).join('')}</ol></section>`;
}

function formatDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function renderHero(article) {
  if (!article.img) return '';
  const original = /^https?:\/\//i.test(article.img) ? article.img : articlePageUrl(article.img);
  const responsiveAttributes = '';
  return `<figure class="article-hero"><div class="article-hero-media"><img src="${escapeHtml(original)}"${responsiveAttributes} alt="${escapeHtml(article.alt || article.title)}" decoding="async" fetchpriority="high" /></div>${article.alt ? `<figcaption>${escapeHtml(article.alt)}</figcaption>` : ''}</figure>`;
}

function relatedFor(article, allArticles) {
  const explicit = Array.isArray(article.relatedSlugs) ? article.relatedSlugs : [];
  const bySlug = new Map(allArticles.map((item) => [item.slug, item]));
  const chosen = explicit
    .map((slug) => bySlug.get(slug))
    .filter((item) => item && (item.body || /^https?:\/\//i.test(item.externalLink || '')));
  for (const item of allArticles) {
    if (chosen.length >= 4) break;
    if (item.slug !== article.slug && item.body && !item.externalLink && item.category === article.category && !chosen.some((entry) => entry.slug === item.slug)) {
      chosen.push(item);
    }
  }
  return chosen.slice(0, 4);
}

function articleLink(article) {
  if (article.externalLink) return articlePageUrl(article.externalLink);
  return articlePageUrl(`articles/${encodeURIComponent(article.slug)}/`);
}

function renderRelated(article, allArticles) {
  const related = relatedFor(article, allArticles);
  if (!related.length) return '';
  return `<section class="related-section" id="relatedSection" aria-labelledby="related-title"><div class="related-heading"><div><p class="eyebrow">Continue exploring</p><h2 class="section-heading" id="related-title">Read next</h2></div><a class="related-all-link" href="${SITE_ROOT_PREFIX}index.html">View all stories <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div><div class="related-grid" id="relatedGrid">${related.map((item) => {
    const link = articleLink(item);
    const external = /^https?:\/\//i.test(link);
    const image = item.img ? `<div class="related-card-media"><img src="${escapeHtml(/^https?:\/\//i.test(item.img) ? item.img : articlePageUrl(item.img))}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" decoding="async" /></div>` : '';
    return `<a class="related-card" href="${escapeHtml(link)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${image}<div class="related-card-body"><span class="category-label">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><span class="related-card-cta">Read article <i class="fas fa-arrow-right" aria-hidden="true"></i></span></div></a>`;
  }).join('')}</div></section>`;
}

function resolveAuthor(article, authors, origin) {
  const entity = (authors || []).find((author) => author.slug === article.authorSlug) || {};
  const slug = entity.slug || article.authorSlug || 'oluwashola-busari';
  const profileUrl = absoluteUrl(entity.profileUrl || 'about.html', origin);
  const id = profileUrl.includes('#') ? profileUrl : `${profileUrl}#${encodeURIComponent(slug)}`;
  return {
    ...entity,
    slug,
    name: entity.name || article.author || 'Oluwashola Busari',
    profileUrl,
    id
  };
}

function schemaFor(article, canonical, author, origin) {
  const graph = [
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      headline: article.title,
      description: article.seoDescription || article.description,
      image: article.img ? [absoluteUrl(article.img, origin)] : undefined,
      datePublished: article.date,
      dateModified: article.updatedAt ? String(article.updatedAt).replace(' ', 'T') + 'Z' : article.date,
      articleSection: article.category,
      keywords: Array.isArray(article.tags) ? article.tags.join(', ') : undefined,
      author: {
        '@type': 'Person',
        '@id': author.id,
        name: author.name,
        url: author.profileUrl,
        jobTitle: author.role || undefined,
        description: author.bio || undefined,
        image: author.image ? absoluteUrl(author.image, origin) : undefined
      },
      publisher: {
        '@type': 'Organization',
        '@id': `${siteUrl('/', origin)}#organization`,
        name: 'Sholynk Technology',
        url: siteUrl('/', origin),
        logo: { '@type': 'ImageObject', url: absoluteUrl('Images and Assets/page_logo.png', origin) }
      },
      citation: article.sources?.length
        ? article.sources.map((source) => source.url).filter(Boolean)
        : undefined
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl('/', origin) },
        { '@type': 'ListItem', position: 2, name: article.category, item: siteUrl(`/?category=${encodeURIComponent(article.category)}`, origin) },
        { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
      ]
    }
  ];
  if (article.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: article.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer }
      }))
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function renderHead(article, canonical, author, origin) {
  const title = article.seoTitle || `${article.title} | Sholynk Technology`;
  const description = article.seoDescription || article.description;
  const image = article.img ? absoluteUrl(article.img, origin) : absoluteUrl('Images and Assets/page_logo.png', origin);
  return `<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="author" content="${escapeHtml(author.name)}" />
    <meta name="theme-color" content="#000000" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Sholynk Technology" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="article:published_time" content="${escapeHtml(article.date)}" />
    <meta property="article:section" content="${escapeHtml(article.category)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <link rel="shortcut icon" href="${SITE_ROOT_PREFIX}Images and Assets/sholynk_icon.png" type="image/png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet" />
    <link href="${SITE_ROOT_PREFIX}styles.css" rel="stylesheet" />
    <script type="application/ld+json">${safeJson(schemaFor(article, canonical, author, origin))}</script>
  </head>`;
}

function renderArticle(article, bodyHtml, canonical, author, origin) {
  const quickAnswer = article.directAnswer
    ? `<aside class="article-answer" aria-labelledby="quick-answer-heading"><div class="article-callout-icon" aria-hidden="true"><i class="fas fa-bolt"></i></div><div><p class="eyebrow" id="quick-answer-heading">Quick answer</p><p>${escapeHtml(article.directAnswer)}</p></div></aside>`
    : '';
  const takeaways = article.keyTakeaways?.length
    ? `<aside class="article-takeaways" aria-labelledby="takeaways-heading"><div class="article-callout-heading"><span class="article-callout-icon" aria-hidden="true"><i class="fas fa-check"></i></span><div><p class="eyebrow">The essentials</p><h2 id="takeaways-heading">Key takeaways</h2></div></div>${renderList(article.keyTakeaways, 'takeaway-list')}</aside>`
    : '';
  const toc = renderToc(bodyHtml);
  const shareText = encodeURIComponent(`${article.title} ${canonical}`);
  const shareUrl = encodeURIComponent(canonical);
  const localAuthorReference = author.id.startsWith(origin)
    ? author.id.slice(origin.length)
    : author.id;
  const authorHref = /^\//.test(localAuthorReference)
    ? articlePageUrl(localAuthorReference)
    : localAuthorReference;
  const contentType = article.contentType
    ? `<span aria-hidden="true">•</span><span>${escapeHtml(article.contentType)}</span>`
    : '';
  const share = `<section class="article-share" aria-labelledby="share-heading"><div class="article-share-copy"><p class="eyebrow">Worth sharing?</p><h2 id="share-heading">Pass this story on</h2></div><div class="article-share-actions"><a href="https://twitter.com/intent/tweet?text=${shareText}" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i><span>X</span></a><a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i><span>Facebook</span></a><a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i><span>WhatsApp</span></a><button type="button" data-copy-article data-copy-url="${escapeHtml(canonical)}" aria-label="Copy article link"><i class="fas fa-link" aria-hidden="true"></i><span>Copy link</span></button></div><p class="article-share-status" role="status" aria-live="polite"></p></section>`;

  const railAuthor = renderAuthorCard(author, 'rail');
  const inlineAuthor = renderAuthorCard(author, 'inline');
  return `<article class="article-page" id="articleRoot" data-server-rendered="true" data-slug="${escapeHtml(article.slug)}" aria-busy="false">
    <div class="article-masthead">
      <nav class="article-breadcrumb" aria-label="Breadcrumb"><a href="${SITE_ROOT_PREFIX}index.html"><i class="fas fa-house" aria-hidden="true"></i><span>Home</span></a><i class="fas fa-chevron-right" aria-hidden="true"></i><a href="${SITE_ROOT_PREFIX}index.html?category=${encodeURIComponent(article.category)}">${escapeHtml(article.category)}</a><i class="fas fa-chevron-right" aria-hidden="true"></i><span aria-current="page">${escapeHtml(article.title)}</span></nav>
      <header class="article-header"><div class="article-kicker"><span class="category-label">${escapeHtml(article.category)}</span>${contentType}<span aria-hidden="true">•</span><span>${escapeHtml(article.readingTime || 'Long read')}</span></div><h1>${escapeHtml(article.title)}</h1><p class="article-standfirst">${escapeHtml(article.hook || article.description)}</p><div class="article-meta"><span class="article-byline"><i class="fas fa-user" aria-hidden="true"></i><a href="${escapeHtml(authorHref)}">${escapeHtml(author.name)}</a></span><span aria-hidden="true">•</span><time datetime="${escapeHtml(article.date)}"><i class="fas fa-calendar" aria-hidden="true"></i>${escapeHtml(formatDate(article.date))}</time></div></header>
    </div>
    ${renderHero(article)}
    <div class="article-reading-layout">
      ${toc || railAuthor ? `<aside class="article-rail">${toc}${railAuthor}<a class="article-rail-home" href="${SITE_ROOT_PREFIX}index.html"><i class="fas fa-arrow-left" aria-hidden="true"></i><span>All stories</span></a></aside>` : ''}
      <div class="article-content">
        ${quickAnswer}
        ${takeaways}
        <div class="article-body">${bodyHtml}</div>
        ${renderFaqs(article.faqs)}
        ${renderSources(article.sources)}
        ${share}
        <div id="engagementRoot"></div>
        ${inlineAuthor}
        <nav class="article-end-nav" aria-label="Article navigation"><a class="article-back" href="${SITE_ROOT_PREFIX}index.html"><i class="fas fa-arrow-left" aria-hidden="true"></i><span>Back to all articles</span></a><a class="article-category-link" href="${SITE_ROOT_PREFIX}index.html?category=${encodeURIComponent(article.category)}"><span>More in ${escapeHtml(article.category)}</span><i class="fas fa-arrow-right" aria-hidden="true"></i></a></nav>
      </div>
    </div>
  </article>`.replace(/^[ \t]+$/gm, '');
}


async function renderArticlePage({ article, articles = [], authors = [], origin }) {
  if (!article || article.status !== 'published' || !article.body || article.externalLink) return null;
  if (!/^https?:\/\//i.test(origin || '')) throw new Error('A valid public origin is required');

  const canonical = article.canonicalUrl || siteUrl(`/articles/${encodeURIComponent(article.slug)}/`, origin);
  const author = resolveAuthor(article, authors, origin);
  const bodyHtml = await addIntrinsicImageSizes(renderMarkdown(article.body));
  const rootHtml = await addIntrinsicImageSizes(renderArticle(article, bodyHtml, canonical, author, origin));
  const relatedHtml = await addIntrinsicImageSizes(renderRelated(
    article,
    articles.filter((item) => item.status === 'published')
  ));
  const shell = localiseShell(fs.readFileSync(SHELL_FILE, 'utf8'));
  return shell
    .replace(/<head>[\s\S]*?<\/head>/, renderHead(article, canonical, author, origin))
    .replace(/<article class="article-page"[\s\S]*?<\/article>/, rootHtml)
    .replace(/<section\s+class="related-section"[\s\S]*?<\/section>/, relatedHtml);
}

module.exports = {
  renderArticlePage,
  renderMarkdown,
  schemaFor,
  relatedFor,
  escapeHtml
};
