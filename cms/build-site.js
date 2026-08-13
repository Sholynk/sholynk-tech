'use strict';

/**
 * Generates crawlable, no-JavaScript article pages and responsive hero images.
 * Originals and the legacy article.html?slug= route are never removed.
 */

const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const IMAGE_DIR = path.join(ROOT, 'generated-images');
const DEFAULT_SITE_URL = 'https://sholynktech.netlify.app';
const SITE_URL = String(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

if (!SITE_URL.startsWith('https://')) {
  throw new Error('SITE_URL must use HTTPS so canonical and schema URLs are secure.');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(value = '') {
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(String(value).replace(/^\/+/, ''), `${SITE_URL}/`).href;
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
 * Markdown is authored from the site root, but generated article pages live at
 * /articles/<slug>/. Rebase local links so `about.html` and
 * `articles/another-story/` do not incorrectly resolve inside the current
 * article directory. Fragments, query-only links, root-relative URLs and links
 * with an explicit scheme already have unambiguous destinations.
 */
function articlePageUrl(value = '') {
  const reference = String(value).trim();
  if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/|\?)/i.test(reference)) {
    return reference;
  }

  try {
    const parsed = new URL(reference, 'https://article-content.invalid/');
    const pathname = parsed.pathname.replace(/^\/+/, '');
    return `../../${pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    return reference;
  }
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
        if (src && !/^(?:https?:|data:|\/)/i.test(src) && !src.includes('..')) src = `../../${src}`;
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
  const items = headings.map((heading) => (
    `<li><a href="#${escapeHtml(heading[1])}">${escapeHtml(heading[2].replace(/<[^>]*>/g, ''))}</a></li>`
  )).join('');
  return `<nav class="article-toc" aria-label="Table of contents"><p class="eyebrow">In this article</p><ol>${items}</ol></nav>`;
}

function localiseShell(shell) {
  return shell.replace(/\b(href|src)="([^"]+)"/g, (match, attribute, value) => {
    if (/^(?:https?:|mailto:|tel:|data:|#|\/)/i.test(value)) return match;
    return `${attribute}="../../${value}"`;
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

async function responsiveHero(article) {
  if (!article.img || /^https?:\/\//i.test(article.img)) return null;
  const input = path.resolve(ROOT, article.img);
  if (!input.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(input)) return null;

  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) return null;
  const outputDir = path.join(IMAGE_DIR, article.slug);
  fs.mkdirSync(outputDir, { recursive: true });

  const widths = [...new Set([640, 1024, 1600].filter((width) => width <= metadata.width).concat(metadata.width))]
    .sort((a, b) => a - b);
  const variants = [];
  for (const width of widths) {
    const filename = `hero-${width}.webp`;
    await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(path.join(outputDir, filename));
    variants.push({ width, path: `../../generated-images/${article.slug}/${filename}` });
  }
  return { variants, width: metadata.width, height: metadata.height };
}

function renderHero(article, responsive) {
  if (!article.img) return '';
  const original = /^https?:\/\//i.test(article.img) ? article.img : `../../${article.img}`;
  const responsiveAttributes = responsive
    ? ` srcset="${responsive.variants.map((item) => `${escapeHtml(item.path)} ${item.width}w`).join(', ')}" sizes="(max-width: 760px) 100vw, 1120px" width="${responsive.width}" height="${responsive.height}"`
    : '';
  return `<figure class="article-hero"><img src="${escapeHtml(original)}"${responsiveAttributes} alt="${escapeHtml(article.alt || article.title)}" decoding="async" fetchpriority="high" /><figcaption>${escapeHtml(article.alt || '')}</figcaption></figure>`;
}

function relatedFor(article, allArticles) {
  const explicit = Array.isArray(article.relatedSlugs) ? article.relatedSlugs : [];
  const bySlug = new Map(allArticles.map((item) => [item.slug, item]));
  const chosen = explicit
    .map((slug) => bySlug.get(slug))
    .filter((item) => item && (item.body || /^https?:\/\//i.test(item.externalLink || '')));
  for (const item of allArticles) {
    if (chosen.length >= 3) break;
    if (item.slug !== article.slug && item.body && !item.externalLink && item.category === article.category && !chosen.some((entry) => entry.slug === item.slug)) {
      chosen.push(item);
    }
  }
  return chosen.slice(0, 3);
}

function articleLink(article) {
  if (article.externalLink) return articlePageUrl(article.externalLink);
  if (article.body) return articlePageUrl(`articles/${encodeURIComponent(article.slug)}/`);
  return articlePageUrl(`article.html?slug=${encodeURIComponent(article.slug)}`);
}

function renderRelated(article, allArticles) {
  const related = relatedFor(article, allArticles);
  if (!related.length) return '';
  return `<section class="related-section" id="relatedSection" aria-labelledby="related-title"><div class="section-title-row"><div><p class="eyebrow">Keep reading</p><h2 class="section-heading" id="related-title">Related stories</h2></div></div><div class="related-grid" id="relatedGrid">${related.map((item) => {
    const link = articleLink(item);
    const external = /^https?:\/\//i.test(link);
    const image = item.img ? `<img src="${escapeHtml(/^https?:\/\//i.test(item.img) ? item.img : `../../${item.img}`)}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" decoding="async" />` : '';
    return `<a class="related-card" href="${escapeHtml(link)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${image}<div><span class="category-label">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div></a>`;
  }).join('')}</div></section>`;
}

function resolveAuthor(article, authors) {
  const entity = (authors || []).find((author) => author.slug === article.authorSlug) || {};
  const slug = entity.slug || article.authorSlug || 'oluwashola-busari';
  const profileUrl = entity.profileUrl || `${SITE_URL}/about.html`;
  const id = profileUrl.includes('#') ? profileUrl : `${profileUrl}#${encodeURIComponent(slug)}`;
  return {
    ...entity,
    slug,
    name: entity.name || article.author || 'Oluwashola Busari',
    profileUrl,
    id
  };
}

function schemaFor(article, canonical, author) {
  const graph = [
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      headline: article.title,
      description: article.seoDescription || article.description,
      image: article.img ? [absoluteUrl(article.img)] : undefined,
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
        image: author.image ? absoluteUrl(author.image) : undefined
      },
      publisher: {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Sholynk Technology',
        url: `${SITE_URL}/`,
        logo: { '@type': 'ImageObject', url: absoluteUrl('Images and Assets/page_logo.png') }
      },
      citation: article.sources?.length
        ? article.sources.map((source) => source.url).filter(Boolean)
        : undefined
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: article.category, item: `${SITE_URL}/?category=${encodeURIComponent(article.category)}` },
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

function renderHead(article, canonical, author) {
  const title = article.seoTitle || `${article.title} | Sholynk Technology`;
  const description = article.seoDescription || article.description;
  const image = article.img ? absoluteUrl(article.img) : absoluteUrl('Images and Assets/page_logo.png');
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
    <link rel="shortcut icon" href="../../Images and Assets/new_page_logo.jpg" type="image/x-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&amp;display=swap" rel="stylesheet" />
    <link href="../../styles.css" rel="stylesheet" />
    <script type="application/ld+json">${safeJson(schemaFor(article, canonical, author))}</script>
  </head>`;
}

function renderArticle(article, bodyHtml, responsive, canonical, author) {
  const quickAnswer = article.directAnswer
    ? `<aside class="article-answer" aria-labelledby="quick-answer-heading"><p class="eyebrow" id="quick-answer-heading">Quick answer</p><p>${escapeHtml(article.directAnswer)}</p></aside>`
    : '';
  const takeaways = article.keyTakeaways?.length
    ? `<aside class="article-takeaways" aria-labelledby="takeaways-heading"><h2 id="takeaways-heading">Key takeaways</h2>${renderList(article.keyTakeaways, 'takeaway-list')}</aside>`
    : '';
  const shareText = encodeURIComponent(`${article.title} ${canonical}`);
  const shareUrl = encodeURIComponent(canonical);
  const authorHref = author.profileUrl === `${SITE_URL}/about.html`
    ? `../../about.html#${encodeURIComponent(author.slug)}`
    : author.profileUrl;
  return `<article class="article-page" id="articleRoot" data-prerendered="true" data-slug="${escapeHtml(article.slug)}" aria-busy="false">
    <nav class="article-breadcrumb" aria-label="Breadcrumb"><a href="../../index.html">Home</a><span aria-hidden="true">/</span><a href="../../index.html?category=${encodeURIComponent(article.category)}">${escapeHtml(article.category)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(article.title)}</span></nav>
    <header class="article-header"><span class="category-label">${escapeHtml(article.category)}</span><h1>${escapeHtml(article.title)}</h1><p class="article-standfirst">${escapeHtml(article.hook || article.description)}</p><div class="article-meta"><span><i class="fas fa-user" aria-hidden="true"></i> <a href="${escapeHtml(authorHref)}">${escapeHtml(author.name)}</a></span><span><i class="fas fa-calendar" aria-hidden="true"></i> <time datetime="${escapeHtml(article.date)}">${escapeHtml(formatDate(article.date))}</time></span><span><i class="fas fa-clock" aria-hidden="true"></i> ${escapeHtml(article.readingTime || '')}</span></div></header>
    ${renderHero(article, responsive)}
    ${quickAnswer}
    ${takeaways}
    ${renderToc(bodyHtml)}
    <div class="article-body">${bodyHtml}</div>
    ${renderFaqs(article.faqs)}
    ${renderSources(article.sources)}
    <div class="article-share"><span>Share this article</span><a href="https://twitter.com/intent/tweet?text=${shareText}" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i></a><a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i></a><a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i></a></div>
    <div id="engagementRoot"></div>
    <a class="article-back" href="../../index.html"><i class="fas fa-arrow-left" aria-hidden="true"></i> Back to all articles</a>
  </article>`.replace(/^[ \t]+$/gm, '');
}

function writeDiscoveryFiles(articles) {
  const staticPages = [
    { path: '/', priority: '1.0', frequency: 'daily' },
    { path: '/about.html', priority: '0.7', frequency: 'monthly' },
    { path: '/contact.html', priority: '0.6', frequency: 'monthly' },
    { path: '/privacy_policy.html', priority: '0.4', frequency: 'yearly' }
  ];
  const urls = staticPages.map((page) => ({ loc: `${SITE_URL}${page.path}`, ...page }));
  for (const article of articles) {
    urls.push({
      loc: article.canonicalUrl || `${SITE_URL}/articles/${encodeURIComponent(article.slug)}/`,
      lastmod: article.date,
      frequency: 'monthly',
      priority: article.featured ? '0.9' : '0.8'
    });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url>\n    <loc>${escapeHtml(url.loc)}</loc>${url.lastmod ? `\n    <lastmod>${escapeHtml(url.lastmod)}</lastmod>` : ''}\n    <changefreq>${url.frequency}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

async function run() {
  const fallback = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-fallback.json'), 'utf8'));
  const allArticles = fallback.articles || [];
  const authors = fallback.authors || [];
  const articles = allArticles.filter((article) => article.status === 'published' && article.body && !article.externalLink);
  const baseShell = localiseShell(fs.readFileSync(path.join(ROOT, 'article.html'), 'utf8'));

  fs.rmSync(ARTICLES_DIR, { recursive: true, force: true });
  fs.rmSync(IMAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  for (const article of articles) {
    const canonical = article.canonicalUrl || `${SITE_URL}/articles/${encodeURIComponent(article.slug)}/`;
    const author = resolveAuthor(article, authors);
    const bodyHtml = renderMarkdown(article.body);
    const responsive = await responsiveHero(article);
    const rootHtml = renderArticle(article, bodyHtml, responsive, canonical, author);
    const relatedHtml = renderRelated(article, allArticles.filter((item) => item.status === 'published'));
    const html = baseShell
      .replace(/<head>[\s\S]*?<\/head>/, renderHead(article, canonical, author))
      .replace(/<article class="article-page"[\s\S]*?<\/article>/, rootHtml)
      .replace(/<section\s+class="related-section"[\s\S]*?<\/section>/, relatedHtml);
    const outputDir = path.join(ARTICLES_DIR, article.slug);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  }

  fs.writeFileSync(path.join(ARTICLES_DIR, 'README.md'), '# Generated article pages\n\nDo not edit this directory by hand. Run `npm run sync` after editing Markdown in `article_stories/`.\n');
  fs.writeFileSync(path.join(IMAGE_DIR, 'README.md'), '# Generated responsive images\n\nThese WebP derivatives are generated non-destructively by `npm run sync`; original images remain unchanged.\n');
  writeDiscoveryFiles(articles);
  console.log(`Generated ${articles.length} crawlable article pages, responsive hero images, sitemap.xml and robots.txt.`);
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run, renderMarkdown, schemaFor, SITE_URL };
