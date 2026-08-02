// Article page: renders a single CMS article, its table of contents and related stories.
(() => {
  const root = document.getElementById('articleRoot');
  const statusEl = document.getElementById('articleStatus');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || params.get('id');

  /** Detect whether raw content is Markdown (no leading HTML tags). */
  function isMarkdown(raw) {
    if (!raw || !raw.trim()) return false;
    const trimmed = raw.trimStart();
    return !trimmed.startsWith('<');
  }

  /** Render content: pass Markdown through the renderer, HTML through the sanitizer. */
  async function renderBody(raw) {
    if (!raw || !raw.trim()) return null;
    if (isMarkdown(raw)) {
      const html = await window.SholynkMarkdown.renderMarkdown(raw);
      const template = document.createElement('template');
      template.innerHTML = html;
      template.content.querySelectorAll('img').forEach((image) => {
        image.loading = 'lazy';
        image.decoding = 'async';
        if (!image.hasAttribute('alt')) image.setAttribute('alt', '');
      });
      return template.content;
    }
    return sanitizeHtml(raw);
  }

  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    template.content.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove());
    template.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (name.startsWith('on') || value.startsWith('javascript:')) node.removeAttribute(attribute.name);
      });
    });
    template.content.querySelectorAll('img').forEach((image) => {
      image.loading = 'lazy';
      image.decoding = 'async';
      if (!image.hasAttribute('alt')) image.setAttribute('alt', '');
    });
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
    if (article.img) document.getElementById('ogImage')?.setAttribute('content', article.img);

    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description,
      image: article.img ? [article.img] : undefined,
      datePublished: article.date,
      author: { '@type': 'Person', name: article.author || 'Sholynk Editorial' },
      publisher: { '@type': 'Organization', name: 'Sholynk Technology' }
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
          image.src = 'photo-1550751827-4bd374c3f58b[1].jpeg';
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
        image.src = 'photo-1550751827-4bd374c3f58b[1].jpeg';
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
    twitter.setAttribute('aria-label', 'Share on X');
    twitter.innerHTML = '<i class="fa-brands fa-x-twitter" aria-hidden="true"></i>';
    const facebook = document.createElement('a');
    facebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    facebook.setAttribute('aria-label', 'Share on Facebook');
    facebook.innerHTML = '<i class="fab fa-facebook-f" aria-hidden="true"></i>';
    const whatsapp = document.createElement('a');
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${article.title} ${url}`)}`;
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

      const siblings = await window.SholynkCMS.getArticles({ category: article.category, limit: 6 });
      renderRelated(siblings.filter((item) => item.slug !== article.slug).slice(0, 3));
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
