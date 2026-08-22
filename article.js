// Long-form article renderer and progressive enhancements.
(() => {
  const root = document.getElementById('articleRoot');
  const statusEl = document.getElementById('articleStatus');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || params.get('id') || root.dataset.slug;
  const isPrerendered = root.dataset.prerendered === 'true';

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /** Detect whether raw content is Markdown (no leading HTML tags). */
  function isMarkdown(raw) {
    if (!raw || !raw.trim()) return false;
    return !raw.trimStart().startsWith('<');
  }

  /**
   * CMS content is authored relative to the site root, but this script also runs
   * on generated pages at <site>/articles/<slug>/ and on sites served from a
   * sub-path (e.g. GitHub Pages project sites at /<repo>/). Root-relative URLs
   * would escape that sub-path and 404, so every local reference is rewritten
   * against the site root derived from the page itself.
   */
  const SITE_ROOT = (() => {
    const homeHref = document
      .querySelector('header a[aria-label="Sholynk homepage"]')
      ?.getAttribute('href') || 'index.html';
    const pathOnly = homeHref.split(/[?#]/, 1)[0];
    const prefix = /index\.html$/i.test(pathOnly)
      ? pathOnly.replace(/index\.html$/i, '')
      : '';
    return new URL(prefix || './', window.location.href);
  })();

  function siteUrl(value = '') {
    const reference = String(value).trim();
    if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(reference)) return reference;
    const relative = reference.replace(/^(?:(?:\.\.?)\/)+/, '').replace(/^\/+/, '');
    return new URL(relative, SITE_ROOT).href;
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

      if (tag === 'a' && node.hasAttribute('href')) {
        if (!hasSafeUrl(node.getAttribute('href'))) {
          node.removeAttribute('href');
          node.removeAttribute('target');
          node.removeAttribute('rel');
        } else {
          node.setAttribute('href', siteUrl(node.getAttribute('href')));
        }
      }
      if (tag === 'img') {
        if (!node.hasAttribute('src') || !hasSafeUrl(node.getAttribute('src'), { image: true })) {
          node.remove();
        } else {
          node.setAttribute('src', siteUrl(node.getAttribute('src')));
        }
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
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function canonicalFor(article) {
    return article.canonicalUrl || new URL(
      `articles/${encodeURIComponent(article.slug || article.id)}/`,
      SITE_ROOT
    ).href;
  }

  function setMeta(article) {
    const title = article.seoTitle || `${article.title} | Sholynk Technology`;
    const description = article.seoDescription || article.description || '';
    const canonicalUrl = canonicalFor(article);
    document.title = title;
    document.getElementById('metaDescription')?.setAttribute('content', description);
    document.getElementById('ogTitle')?.setAttribute('content', title);
    document.getElementById('ogDescription')?.setAttribute('content', description);
    if (article.img) {
      document.getElementById('ogImage')?.setAttribute(
        'content',
        siteUrl(article.img)
      );
    }

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
      image: article.img ? [siteUrl(article.img)] : undefined,
      datePublished: article.date,
      author: {
        '@type': 'Person',
        name: article.author || 'Sholynk Editorial',
        url: siteUrl('about.html')
      },
      publisher: {
        '@type': 'Organization',
        name: 'Sholynk Technology',
        url: siteUrl('index.html')
      }
    });
    document.head.append(jsonLd);
  }

  function buildToc(bodyEl) {
    const headings = [...bodyEl.querySelectorAll('h2')];
    if (headings.length < 3) return null;

    const details = create('details', 'article-toc');
    details.open = true;
    const summary = document.createElement('summary');
    summary.innerHTML = '<span><small>Navigate</small>In this article</span><i class="fas fa-chevron-down" aria-hidden="true"></i>';
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Table of contents');
    const list = document.createElement('ol');

    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = `section-${index + 1}`;
      heading.setAttribute('tabindex', '-1');
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      if (index === 0) link.setAttribute('aria-current', 'location');
      link.append(create('span', '', heading.textContent));
      item.append(link);
      list.append(item);
    });

    nav.append(list);
    details.append(summary, nav);
    return details;
  }

  function articleDestination(article) {
    if (/^https?:\/\//i.test(article.externalLink || '')) return article.externalLink;
    if (article.body && article.slug) return siteUrl(`articles/${encodeURIComponent(article.slug)}/`);
    return siteUrl(article.link || `article.html?slug=${encodeURIComponent(article.slug || article.id)}`);
  }

  function renderRelated(related) {
    const section = document.getElementById('relatedSection');
    const grid = document.getElementById('relatedGrid');
    if (!section || !grid || !related.length) return;

    grid.innerHTML = '';
    related.forEach((article) => {
      const card = create('a', 'related-card');
      card.href = articleDestination(article);
      if (/^https?:\/\//i.test(card.getAttribute('href'))) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }

      if (article.img) {
        const media = create('div', 'related-card-media');
        const image = document.createElement('img');
        image.src = siteUrl(article.img);
        image.alt = article.alt || article.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
          image.src = siteUrl('Images and Assets/photo-1550751827-4bd374c3f58b[1].jpeg');
        }, { once: true });
        media.append(image);
        card.append(media);
      }

      const body = create('div', 'related-card-body');
      body.append(create('span', 'category-label', article.category));
      body.append(create('h3', '', article.title));
      body.append(create('p', '', article.description));
      const cta = create('span', 'related-card-cta', 'Read article ');
      cta.insertAdjacentHTML('beforeend', '<i class="fas fa-arrow-right" aria-hidden="true"></i>');
      body.append(cta);
      card.append(body);
      grid.append(card);
    });

    section.hidden = false;
  }

  function initReadingProgress() {
    const bar = document.getElementById('readingProgressBar');
    if (!bar || bar.dataset.enhanced === 'true') return;
    bar.dataset.enhanced = 'true';
    let ticking = false;
    const update = () => {
      const articleTop = root.getBoundingClientRect().top + window.scrollY;
      const articleEnd = articleTop + root.offsetHeight - window.innerHeight;
      const distance = Math.max(articleEnd - articleTop, 1);
      const ratio = Math.max(0, Math.min(1, (window.scrollY - articleTop) / distance));
      bar.style.width = `${ratio * 100}%`;
      ticking = false;
    };
    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      (window.requestAnimationFrame || window.setTimeout)(update);
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    update();
  }

  function fallbackCopy(value) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  function initCopyButton(articleRoot) {
    articleRoot.querySelectorAll('[data-copy-article]').forEach((button) => {
      if (button.dataset.enhanced === 'true') return;
      button.dataset.enhanced = 'true';
      button.addEventListener('click', async () => {
        const value = button.dataset.copyUrl || document.querySelector('link[rel="canonical"]')?.href || window.location.href;
        const status = button.closest('.article-share')?.querySelector('.article-share-status');
        let copied = false;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            copied = true;
          } else {
            copied = fallbackCopy(value);
          }
        } catch (error) {
          copied = fallbackCopy(value);
        }
        if (status) status.textContent = copied ? 'Link copied to your clipboard.' : 'Select and copy the address from your browser.';
        const label = button.querySelector('span');
        const original = label?.textContent;
        if (label && copied) {
          label.textContent = 'Copied';
          window.setTimeout(() => { label.textContent = original; }, 1800);
        }
      });
    });
  }

  /**
   * Distance to keep between the top of the viewport and the heading we land
   * on. The site header is sticky, so a heading parked at scroll offset 0 would
   * sit underneath it; reserve its height plus a small breathing gap.
   */
  function headingOffset(element) {
    // Headings declare `scroll-margin-top` in the stylesheet; honour it so the
    // scripted landing matches native anchor behaviour exactly.
    const declared = typeof window.getComputedStyle === 'function'
      ? parseFloat(window.getComputedStyle(element).scrollMarginTop)
      : NaN;
    if (Number.isFinite(declared) && declared > 0) return declared;

    const header = document.querySelector('.site-header');
    // getBoundingClientRect().height still reports the real height while the
    // auto-hiding header is translated off-screen, which is what we want: the
    // header can slide back into view at any moment.
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    return Math.round((Number.isFinite(headerHeight) ? headerHeight : 0) + 16);
  }

  /** Absolute page offset that puts `element`'s own top edge into view. */
  function desiredScrollTop(element) {
    const top = element.getBoundingClientRect().top + window.scrollY - headingOffset(element);

    // Clamp to the last scrollable pixel so the correction cannot request an
    // offset the page can never reach. Only trust a document height that is
    // actually measurable: if it is missing or absurdly small the clamp would
    // otherwise collapse every target to the top of the page.
    const documentHeight = Math.max(
      document.documentElement?.scrollHeight || 0,
      document.body?.scrollHeight || 0
    );
    const target = Math.max(0, top);
    if (documentHeight <= window.innerHeight) return target;
    return Math.min(target, documentHeight - window.innerHeight);
  }

  function scrollWindowTo(top, smooth) {
    try {
      window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    } catch (error) {
      window.scrollTo(0, top);
    }
  }

  /**
   * Scroll a heading to the top of the reading area and keep it there.
   *
   * Article bodies are full of lazily loaded images that have no intrinsic
   * width/height, so they occupy zero space until they decode. Any measurement
   * taken at click time is therefore provisional: as images above and around
   * the target resolve, the document reflows and the heading drifts away from
   * where it was aimed — which is how a jump to a section title ends up parked
   * somewhere inside (or past) that section. After the initial scroll we
   * re-measure for a short while and correct the landing, bailing out the
   * moment the reader takes over scrolling themselves.
   */
  function scrollHeadingIntoView(heading, { smooth = true } = {}) {
    // `scrollIntoView` with block:'start' honours the heading's
    // `scroll-margin-top`, so it is the most faithful first move.
    if (typeof heading.scrollIntoView === 'function') {
      heading.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    } else {
      scrollWindowTo(desiredScrollTop(heading), smooth);
    }

    if (typeof window.scrollTo !== 'function') return;

    let cancelled = false;
    const cancel = () => { cancelled = true; };
    const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    userEvents.forEach((type) => window.addEventListener(type, cancel, { passive: true, once: true }));

    const deadline = Date.now() + 1600;
    const settle = () => {
      if (cancelled) return;
      const desired = desiredScrollTop(heading);
      // Only correct once the smooth animation has come to rest, otherwise we
      // would fight it mid-flight.
      if (Math.abs(desired - window.scrollY) > 2) scrollWindowTo(desired, false);
      if (Date.now() < deadline) {
        window.setTimeout(settle, 120);
      } else {
        userEvents.forEach((type) => window.removeEventListener(type, cancel));
      }
    };
    window.setTimeout(settle, smooth ? 420 : 60);
  }

  function initToc(articleRoot) {
    const toc = articleRoot.querySelector('.article-toc');
    if (!toc || toc.dataset.enhanced === 'true') return;
    toc.dataset.enhanced = 'true';

    const compact = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 920px)')
      : null;
    if (compact?.matches) toc.open = false;
    const handleBreakpoint = (event) => { toc.open = !event.matches; };
    compact?.addEventListener?.('change', handleBreakpoint);

    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const headingLinks = new Map();
    links.forEach((link) => {
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      const heading = document.getElementById(id);
      if (!heading) return;
      headingLinks.set(heading, link);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        // Collapsing the compact TOC removes height above the body, so do it
        // before measuring where the heading needs to land.
        if (compact?.matches) toc.open = false;
        scrollHeadingIntoView(heading, { smooth: !reducedMotion });
        try {
          window.history.pushState(null, '', `#${encodeURIComponent(id)}`);
        } catch (error) {
          window.location.hash = id;
        }
        window.setTimeout(() => heading.focus({ preventScroll: true }), reducedMotion ? 0 : 350);
        links.forEach((item) => item.removeAttribute('aria-current'));
        link.setAttribute('aria-current', 'location');
      });
    });

    // Deep links (and back/forward between sections) must land on the heading
    // too, not wherever the browser guessed before the images resolved.
    const settleHash = () => {
      const id = decodeURIComponent((window.location.hash || '').slice(1));
      if (!id) return;
      const heading = document.getElementById(id);
      if (!heading || !headingLinks.has(heading)) return;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scrollHeadingIntoView(heading, { smooth: !reducedMotion });
      links.forEach((item) => item.removeAttribute('aria-current'));
      headingLinks.get(heading).setAttribute('aria-current', 'location');
    };
    if (window.location.hash) window.setTimeout(settleHash, 0);
    window.addEventListener('hashchange', settleHash);

    if ('IntersectionObserver' in window && headingLinks.size) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        links.forEach((link) => link.removeAttribute('aria-current'));
        headingLinks.get(visible.target)?.setAttribute('aria-current', 'location');
      }, { rootMargin: '-15% 0px -70% 0px' });
      headingLinks.forEach((link, heading) => observer.observe(heading));
    }
  }

  function initArticleInteractions(articleRoot) {
    if (articleRoot.dataset.linksEnhanced === 'true') return;
    articleRoot.dataset.linksEnhanced = 'true';
    enhanceExternalLinks(articleRoot);
    initCopyButton(articleRoot);
    initToc(articleRoot);
  }

  function createBreadcrumb(article) {
    const breadcrumb = create('nav', 'article-breadcrumb');
    breadcrumb.setAttribute('aria-label', 'Breadcrumb');
    const home = create('a');
    home.href = siteUrl('index.html');
    home.innerHTML = '<i class="fas fa-house" aria-hidden="true"></i><span>Home</span>';
    const category = create('a', '', article.category);
    category.href = siteUrl(`index.html?category=${encodeURIComponent(article.category)}`);
    const current = create('span', '', article.title);
    current.setAttribute('aria-current', 'page');
    const divider = () => {
      const icon = create('i', 'fas fa-chevron-right');
      icon.setAttribute('aria-hidden', 'true');
      return icon;
    };
    breadcrumb.append(home, divider(), category, divider(), current);
    return breadcrumb;
  }

  function createHeader(article) {
    const header = create('header', 'article-header');
    const kicker = create('div', 'article-kicker');
    kicker.append(create('span', 'category-label', article.category));
    if (article.contentType) {
      kicker.append(create('span', '', '•'), create('span', '', article.contentType));
    }
    kicker.append(create('span', '', '•'), create('span', '', article.readingTime || 'Long read'));

    const title = create('h1', '', article.title);
    const standfirst = create('p', 'article-standfirst', article.hook || article.description || '');
    const meta = create('div', 'article-meta');
    const byline = create('span', 'article-byline');
    const authorIcon = create('i', 'fas fa-user');
    authorIcon.setAttribute('aria-hidden', 'true');
    byline.append(authorIcon);
    const author = create('a', '', article.author || 'Sholynk Editorial');
    author.href = siteUrl(`about.html#${encodeURIComponent(article.authorSlug || 'oluwashola-busari')}`);
    byline.append(author);
    const published = create('time', '');
    const dateIcon = create('i', 'fas fa-calendar');
    dateIcon.setAttribute('aria-hidden', 'true');
    published.append(dateIcon, document.createTextNode(` ${formatDate(article.date)}`));
    published.dateTime = article.date || '';
    meta.append(byline, create('span', '', '•'), published);
    header.append(kicker, title, standfirst, meta);
    return header;
  }

  function createHero(article) {
    if (!article.img) return null;
    const hero = create('figure', 'article-hero');
    const media = create('div', 'article-hero-media');
    const image = document.createElement('img');
    image.src = siteUrl(article.img);
    image.alt = article.alt || article.title;
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.width = 1600;
    image.height = 900;
    image.addEventListener('error', () => {
      image.src = siteUrl('Images and Assets/photo-1550751827-4bd374c3f58b[1].jpeg');
    }, { once: true });
    media.append(image);
    hero.append(media);
    if (article.alt) hero.append(create('figcaption', '', article.alt));
    return hero;
  }

  function createCallouts(article) {
    const nodes = [];
    if (article.directAnswer) {
      const answer = create('aside', 'article-answer');
      answer.setAttribute('aria-labelledby', 'quick-answer-heading');
      const icon = create('div', 'article-callout-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<i class="fas fa-bolt"></i>';
      const copy = create('div');
      const label = create('p', 'eyebrow', 'Quick answer');
      label.id = 'quick-answer-heading';
      copy.append(label, create('p', '', article.directAnswer));
      answer.append(icon, copy);
      nodes.push(answer);
    }
    if (Array.isArray(article.keyTakeaways) && article.keyTakeaways.length) {
      const takeaways = create('aside', 'article-takeaways');
      takeaways.setAttribute('aria-labelledby', 'takeaways-heading');
      const headingRow = create('div', 'article-callout-heading');
      const icon = create('span', 'article-callout-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<i class="fas fa-check"></i>';
      const copy = create('div');
      copy.append(create('p', 'eyebrow', 'The essentials'));
      const heading = create('h2', '', 'Key takeaways');
      heading.id = 'takeaways-heading';
      copy.append(heading);
      headingRow.append(icon, copy);
      const list = create('ul', 'takeaway-list');
      article.keyTakeaways.forEach((item) => list.append(create('li', '', item)));
      takeaways.append(headingRow, list);
      nodes.push(takeaways);
    }
    return nodes;
  }

  function createFaq(article) {
    if (!Array.isArray(article.faqs) || !article.faqs.length) return null;
    const section = create('section', 'article-faq');
    section.setAttribute('aria-labelledby', 'faq-heading');
    const heading = create('h2', '', 'Frequently asked questions');
    heading.id = 'faq-heading';
    section.append(heading);
    article.faqs.forEach((faq) => {
      const details = document.createElement('details');
      details.append(create('summary', '', faq.question), create('p', '', faq.answer));
      section.append(details);
    });
    return section;
  }

  function createSources(article) {
    if (!Array.isArray(article.sources) || !article.sources.length) return null;
    const section = create('section', 'article-sources');
    section.setAttribute('aria-labelledby', 'sources-heading');
    const heading = create('h2', '', 'Sources');
    heading.id = 'sources-heading';
    const list = document.createElement('ol');
    article.sources.forEach((source) => {
      const item = document.createElement('li');
      const link = create('a', '', source.title || source.url);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      const details = [source.author, source.publisher, source.publishedAt].filter(Boolean).join(', ');
      if (details) item.append(document.createTextNode(` — ${details}`));
      if (source.supports) item.append(create('span', '', `Supports: ${source.supports}`));
      list.append(item);
    });
    section.append(heading, list);
    return section;
  }

  function createShare(article) {
    const canonical = canonicalFor(article);
    const section = create('section', 'article-share');
    section.setAttribute('aria-labelledby', 'share-heading');
    const copy = create('div', 'article-share-copy');
    copy.append(create('p', 'eyebrow', 'Worth sharing?'));
    const heading = create('h2', '', 'Pass this story on');
    heading.id = 'share-heading';
    copy.append(heading);

    const actions = create('div', 'article-share-actions');
    const links = [
      ['https://twitter.com/intent/tweet?text=' + encodeURIComponent(`${article.title} ${canonical}`), 'fa-brands fa-x-twitter', 'X'],
      ['https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(canonical), 'fab fa-facebook-f', 'Facebook'],
      ['https://wa.me/?text=' + encodeURIComponent(`${article.title} ${canonical}`), 'fab fa-whatsapp', 'WhatsApp']
    ];
    links.forEach(([href, iconClass, label]) => {
      const link = create('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Share on ${label}`);
      link.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i><span></span>`;
      link.querySelector('span').textContent = label;
      actions.append(link);
    });
    const copyButton = create('button');
    copyButton.type = 'button';
    copyButton.dataset.copyArticle = '';
    copyButton.dataset.copyUrl = canonical;
    copyButton.setAttribute('aria-label', 'Copy article link');
    copyButton.innerHTML = '<i class="fas fa-link" aria-hidden="true"></i><span>Copy link</span>';
    actions.append(copyButton);
    const status = create('p', 'article-share-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    section.append(copy, actions, status);
    return section;
  }

  function createEndNavigation(article) {
    const nav = create('nav', 'article-end-nav');
    nav.setAttribute('aria-label', 'Article navigation');
    const back = create('a', 'article-back');
    back.href = siteUrl('index.html');
    back.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i><span>Back to all articles</span>';
    const category = create('a', 'article-category-link');
    category.href = siteUrl(`index.html?category=${encodeURIComponent(article.category)}`);
    category.append(create('span', '', `More in ${article.category}`));
    category.insertAdjacentHTML('beforeend', '<i class="fas fa-arrow-right" aria-hidden="true"></i>');
    nav.append(back, category);
    return nav;
  }

  function createAuthorCard(author) {
    if (!author || (!author.image && !(author.bio || '').trim() && !(author.name || '').trim())) {
      return null;
    }
    const card = create('aside', 'article-author-card');
    card.setAttribute('aria-label', `About ${author.name || 'the author'}`);
    const media = create('div', 'article-author-media');
    if (author.image) {
      const img = document.createElement('img');
      img.src = siteUrl(author.image);
      img.alt = author.imageAlt || `Photo of ${author.name || 'the author'}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => { img.remove(); }, { once: true });
      media.append(img);
    } else {
      const placeholder = create('div', 'article-author-avatar');
      const initials = (author.name || 'A')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('');
      placeholder.textContent = initials || 'A';
      media.append(placeholder);
    }
    const body = create('div', 'article-author-body');
    const eyebrow = create('p', 'eyebrow', 'Written by');
    const name = create('h3', '', author.name || 'Sholynk Editorial');
    if (author.role) name.dataset.role = author.role;
    body.append(eyebrow, name);
    // The role is intentionally omitted from the card: the bio already covers
    // it, so rendering both repeats the same information. The field is still
    // stored and used for structured data and the admin author list.
    if (author.bio) body.append(create('p', 'article-author-bio', author.bio));
    if (author.profileUrl) {
      const link = create('a', 'article-author-link');
      link.href = author.profileUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(document.createTextNode('View full profile '));
      link.insertAdjacentHTML('beforeend', '<i class="fas fa-arrow-right" aria-hidden="true"></i>');
      body.append(link);
    }
    card.append(media, body);
    return card;
  }

  async function lookupAuthor(article) {
    const slug = article.authorSlug;
    if (!slug) return null;
    try {
      const authors = await window.SholynkCMS.getAuthors();
      return (authors || []).find((a) => a.slug === slug) || null;
    } catch (error) {
      return null;
    }
  }

  async function renderArticle(article) {
    root.innerHTML = '';
    root.setAttribute('aria-busy', 'false');

    const author = await lookupAuthor(article);

    const masthead = create('div', 'article-masthead');
    masthead.append(createBreadcrumb(article), createHeader(article));

    const body = create('div', 'article-body');
    if (article.body && article.body.trim()) {
      body.append(await renderBody(article.body));
    } else {
      body.append(create('p', '', article.description || 'This story is being written. Check back shortly.'));
    }

    const layout = create('div', 'article-reading-layout');
    const toc = buildToc(body);
    const railAuthor = author ? createAuthorCard(author) : null;
    if (toc || railAuthor) {
      const rail = create('aside', 'article-rail');
      if (toc) rail.append(toc);
      if (railAuthor) {
        railAuthor.classList.add('article-author-card--rail');
        rail.append(railAuthor);
      }
      const railHome = create('a', 'article-rail-home');
      railHome.href = siteUrl('index.html');
      railHome.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i><span>All stories</span>';
      rail.append(railHome);
      layout.append(rail);
    }

    const content = create('div', 'article-content');
    content.append(...createCallouts(article), body);
    const faq = createFaq(article);
    if (faq) content.append(faq);
    const sources = createSources(article);
    if (sources) content.append(sources);
    content.append(createShare(article));
    const engagementRoot = document.createElement('div');
    engagementRoot.id = 'engagementRoot';
    content.append(engagementRoot);
    // Mobile / bottom-of-article author card. It follows the reactions and
    // comments section and sits just before the "Back to all articles" nav.
    // On desktop this copy is hidden in favor of the one in the left rail.
    const contentAuthor = author ? createAuthorCard(author) : null;
    if (contentAuthor) {
      contentAuthor.classList.add('article-author-card--inline');
      content.append(contentAuthor);
    }
    content.append(createEndNavigation(article));
    layout.append(content);

    root.append(masthead);
    const hero = createHero(article);
    if (hero) root.append(hero);
    root.append(layout);

    setMeta(article);
    initArticleInteractions(root);
    initReadingProgress();
    window.SholynkEngagement?.mount(engagementRoot, {
      slug: article.slug || String(article.id)
    });
  }

  function renderMissing() {
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = '';
    const wrapper = create('div', 'empty-state');
    wrapper.append(
      create('h3', '', 'Article not found'),
      create('p', '', 'This story may have been moved or unpublished. Browse the homepage for the latest articles.')
    );
    const link = create('a', 'article-back', 'Back to homepage');
    link.href = siteUrl('index.html');
    wrapper.append(link);
    root.append(wrapper);
  }

  async function init() {
    // Clean-path pages already contain the full article in their initial HTML.
    if (isPrerendered) {
      initArticleInteractions(root);
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
      )).slice(0, 4));
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
