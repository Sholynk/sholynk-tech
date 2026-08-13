// Article page: renders a single CMS article, its table of contents and related stories.
(() => {
  const root = document.getElementById('articleRoot');
  const statusEl = document.getElementById('articleStatus');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || params.get('id') || root.dataset.slug;
  const isPrerendered = root.dataset.prerendered === 'true';

  /** Detect whether raw content is Markdown (no leading HTML tags). */
  function isMarkdown(raw) {
    if (!raw || !raw.trim()) return false;
    const trimmed = raw.trimStart();
    return !trimmed.startsWith('<');
  }

  function enhanceExternalLinks(rootFragment) {
    rootFragment.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
    });
  }

  /** Render content: pass Markdown through the renderer, HTML through the sanitizer. */
  async function renderBody(raw) {
    if (!raw || !raw.trim()) return null;
    if (isMarkdown(raw)) {
      const html = await window.SholynkMarkdown.renderMarkdown(raw);
      return sanitizeHtml(html);
    }
    return sanitizeHtml(raw);
  }

  function hasSafeUrl(value, { image = false } = {}) {
    const raw = String(value || '').trim();
    const compact = raw.replace(/[\u0000-\u0020]+/g, '');
    if (!compact) return false;
    if (compact.startsWith('#') && !image) return true;
    if (/^(?:\.?\.?\/|\/)(?!\/)/.test(compact)) return true;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(compact)) return !compact.startsWith('//');
    return image ? /^https?:/i.test(compact) : /^(?:https?:|mailto:)/i.test(compact);
  }

  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    template.content
      .querySelectorAll('script, style, iframe, object, embed, svg, math, form, input, button, textarea, select')
      .forEach((node) => node.remove());

    const allowedTags = new Set([
      'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em',
      'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
      'kbd', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub',
      'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'
    ]);
    const globalAttributes = new Set(['id', 'class']);
    const attributesByTag = {
      a: new Set(['href', 'title', 'target', 'rel']),
      img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding']),
      code: new Set(['class']),
      th: new Set(['scope', 'colspan', 'rowspan']),
      td: new Set(['colspan', 'rowspan'])
    };

    template.content.querySelectorAll('*').forEach((node) => {
      const tag = node.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        node.replaceWith(...node.childNodes);
        return;
      }

      const allowedAttributes = attributesByTag[tag] || new Set();
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        if (!globalAttributes.has(name) && !allowedAttributes.has(name)) {
          node.removeAttribute(attribute.name);
        }
      });

      if (tag === 'a' && node.hasAttribute('href') && !hasSafeUrl(node.getAttribute('href'))) {
        node.removeAttribute('href');
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
      if (tag === 'img' && (!node.hasAttribute('src') || !hasSafeUrl(node.getAttribute('src'), { image: true }))) {
        node.remove();
      }
    });

    template.content.querySelectorAll('img').forEach((image) => {
      image.loading = 'lazy';
      image.decoding = 'async';
      if (!image.hasAttribute('alt')) image.setAttribute('alt', '');
    });
    enhanceExternalLinks(template.content);
    return template.content;
  }

  function formatDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) return value || '';
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function setMeta(article) {
    const title = article.seoTitle || `${article.title} | Sholynk Technology`;
    document.title = title;
    const description = article.seoDescription || article.description || '';
    document.getElementById('metaDescription')?.setAttribute('content', description);
    document.getElementById('ogTitle')?.setAttribute('content', title);
    document.getElementById('ogDescription')?.setAttribute('content', description);
    if (article.img) {
      document
        .getElementById('ogImage')
        ?.setAttribute('content', new URL(article.img, window.location.href).href);
    }

    const canonicalUrl = article.canonicalUrl || new URL(
      `articles/${encodeURIComponent(article.slug)}/`,
      `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`
    ).href;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    canonical.href = canonicalUrl;
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.append(ogUrl);
    }
    ogUrl.setAttribute('content', canonicalUrl);

    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: canonicalUrl,
      headline: article.title,
      description,
      image: article.img ? [new URL(article.img, window.location.href).href] : undefined,
      datePublished: article.date,
      author: { '@type': 'Person', name: article.author || 'Sholynk Editorial', url: new URL('about.html', window.location.href).href },
      publisher: { '@type': 'Organization', name: 'Sholynk Technology', url: new URL('index.html', window.location.href).href }
    });
    document.head.append(jsonLd);
  }

  function buildToc(bodyEl) {
    const headings = [...bodyEl.querySelectorAll('h2')];
    if (headings.length < 3) return null;

    const nav = document.createElement('nav');
    nav.className = 'article-toc';
    nav.setAttribute('aria-label', 'Table of contents');

    const heading = document.createElement('p');
    heading.className = 'eyebrow';
    heading.textContent = 'In this article';

    const list = document.createElement('ol');
    headings.forEach((node, index) => {
      if (!node.id) node.id = `section-${index + 1}`;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${node.id}`;
      link.textContent = node.textContent;
      item.append(link);
      list.append(item);
    });

    nav.append(heading, list);
    return nav;
  }

  function renderRelated(related) {
    const section = document.getElementById('relatedSection');
    const grid = document.getElementById('relatedGrid');
    if (!section || !grid || !related.length) return;

    related.forEach((article) => {
      const card = document.createElement('a');
      card.className = 'related-card';
      card.href = article.link;

      if (article.img) {
        const image = document.createElement('img');
        image.src = article.img;
        image.alt = article.alt || article.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
          image.src = 'Images and Assets/photo-1550751827-4bd374c3f58b[1].jpeg';
        }, { once: true });
        card.append(image);
      }

      const body = document.createElement('div');
      const category = document.createElement('span');
      category.className = 'category-label';
      category.textContent = article.category;
      const title = document.createElement('h3');
      title.textContent = article.title;
      const description = document.createElement('p');
      description.textContent = article.description;
      body.append(category, title, description);
      card.append(body);
      grid.append(card);
    });

    section.hidden = false;
  }

  function initReadingProgress() {
    const bar = document.getElementById('readingProgressBar');
    if (!bar) return;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.width = `${ratio * 100}%`;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  async function renderArticle(article) {
    root.innerHTML = '';
    root.setAttribute('aria-busy', 'false');

    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'article-breadcrumb';
    breadcrumb.setAttribute('aria-label', 'Breadcrumb');
    breadcrumb.innerHTML =
      `<a href="index.html">Home</a><span aria-hidden="true">/</span>` +
      `<a href="index.html?category=${encodeURIComponent(article.category)}"></a>` +
      `<span aria-hidden="true">/</span><span aria-current="page"></span>`;
    breadcrumb.querySelectorAll('a')[1].textContent = article.category;
    breadcrumb.querySelector('[aria-current]').textContent = article.title;

    const header = document.createElement('header');
    header.className = 'article-header';

    const category = document.createElement('span');
    category.className = 'category-label';
    category.textContent = article.category;

    const title = document.createElement('h1');
    title.textContent = article.title;

    const standfirst = document.createElement('p');
    standfirst.className = 'article-standfirst';
    standfirst.textContent = article.description || '';

    const meta = document.createElement('div');
    meta.className = 'article-meta';
    meta.innerHTML =
      `<span><i class="fas fa-user" aria-hidden="true"></i> <span class="author"></span></span>` +
      `<span><i class="fas fa-calendar" aria-hidden="true"></i> <span class="date"></span></span>` +
      `<span><i class="fas fa-clock" aria-hidden="true"></i> <span class="time"></span></span>`;
    meta.querySelector('.author').textContent = article.author || 'Sholynk Editorial';
    meta.querySelector('.date').textContent = formatDate(article.date);
    meta.querySelector('.time').textContent = article.readingTime || '';

    header.append(category, title, standfirst, meta);

    let hero = null;
    if (article.img) {
      hero = document.createElement('figure');
      hero.className = 'article-hero';
      const image = document.createElement('img');
      image.src = article.img;
      image.alt = article.alt || article.title;
      image.decoding = 'async';
      image.width = 1600;
      image.height = 900;
      image.addEventListener('error', () => {
        image.src = 'Images and Assets/photo-1550751827-4bd374c3f58b[1].jpeg';
      }, { once: true });
      hero.append(image);
      if (article.alt) {
        const caption = document.createElement('figcaption');
        caption.textContent = article.alt;
        hero.append(caption);
      }
    }

    const body = document.createElement('div');
    body.className = 'article-body';
    if (article.body && article.body.trim()) {
      body.append(await renderBody(article.body));
    } else {
      const fallback = document.createElement('p');
      fallback.textContent = article.description || 'This story is being written. Check back shortly.';
      body.append(fallback);
    }

    const toc = buildToc(body);

    const share = document.createElement('div');
    share.className = 'article-share';
    const shareLabel = document.createElement('span');
    shareLabel.textContent = 'Share this article';
    const url = window.location.href;
    const twitter = document.createElement('a');
    twitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(url)}`;
    twitter.target = '_blank';
    twitter.rel = 'noopener noreferrer';
    twitter.setAttribute('aria-label', 'Share on X');
    twitter.innerHTML = '<i class="fa-brands fa-x-twitter" aria-hidden="true"></i>';
    const facebook = document.createElement('a');
    facebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    facebook.target = '_blank';
    facebook.rel = 'noopener noreferrer';
    facebook.setAttribute('aria-label', 'Share on Facebook');
    facebook.innerHTML = '<i class="fab fa-facebook-f" aria-hidden="true"></i>';
    const whatsapp = document.createElement('a');
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${article.title} ${url}`)}`;
    whatsapp.target = '_blank';
    whatsapp.rel = 'noopener noreferrer';
    whatsapp.setAttribute('aria-label', 'Share on WhatsApp');
    whatsapp.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i>';
    share.append(shareLabel, twitter, facebook, whatsapp);

    const backLink = document.createElement('a');
    backLink.className = 'article-back';
    backLink.href = 'index.html';
    backLink.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i> Back to all articles';

    // Reactions and comments, keyed by the article slug.
    const engagementRoot = document.createElement('div');
    engagementRoot.id = 'engagementRoot';

    root.append(breadcrumb, header);
    if (hero) root.append(hero);
    if (toc) root.append(toc);
    root.append(body, share, engagementRoot, backLink);

    window.SholynkEngagement?.mount(engagementRoot, {
      slug: article.slug || String(article.id)
    });

    setMeta(article);
    initReadingProgress();
  }

  function renderMissing() {
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'empty-state';
    const heading = document.createElement('h3');
    heading.textContent = 'Article not found';
    const message = document.createElement('p');
    message.textContent = 'This story may have been moved or unpublished. Browse the homepage for the latest articles.';
    const link = document.createElement('a');
    link.href = 'index.html';
    link.className = 'article-back';
    link.textContent = 'Back to homepage';
    wrapper.append(heading, message, link);
    root.append(wrapper);
  }

  async function init() {
    // Clean-path pages already contain the full article in their initial HTML.
    // Keep progressive enhancement (reading progress and engagement) without
    // replacing crawlable content or requiring an API request.
    if (isPrerendered) {
      const engagementRoot = document.getElementById('engagementRoot');
      if (engagementRoot && slug) window.SholynkEngagement?.mount(engagementRoot, { slug });
      initReadingProgress();
      return;
    }
    if (!slug) {
      renderMissing();
      return;
    }
    try {
      const article = await window.SholynkCMS.getArticle(slug);
      if (!article) {
        renderMissing();
        return;
      }
      await renderArticle(article);

      const siblings = await window.SholynkCMS.getArticles({ category: article.category });
      renderRelated(siblings.filter((item) => (
        item.slug !== article.slug
        && (Boolean(item.body && item.body.trim()) || /^https?:\/\//i.test(item.externalLink || ''))
      )).slice(0, 3));
    } catch (error) {
      console.error(error);
      if (statusEl) statusEl.textContent = 'Unable to load this article right now.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
