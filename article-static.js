// Behaviour for hand-authored article pages (article_01.html).
//
// The CMS-rendered page gets these from article.js. This file provides the same
// enhancements — Markdown rendering, reading progress bar, TOC generation and
// engagement widgets — for pages whose content lives in a .md file.
(() => {
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

  function initEngagement() {
    const root = document.getElementById('engagementRoot');
    if (!root || !window.SholynkEngagement) return;
    const slug = root.dataset.articleSlug;
    if (!slug) return;
    window.SholynkEngagement.mount(root, { slug });
  }

  /** Build a TOC from h2 elements in the rendered body. */
  function buildToc(container) {
    const toc = document.getElementById('articleToc');
    if (!toc) return;

    const headings = [...container.querySelectorAll('h2')];
    if (headings.length < 3) {
      toc.hidden = true;
      return;
    }

    const label = document.createElement('p');
    label.className = 'eyebrow';
    label.textContent = 'In this article';

    const list = document.createElement('ol');
    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = `section-${index + 1}`;
      heading.setAttribute('tabindex', '-1');
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      item.append(link);
      list.append(item);
    });

    toc.innerHTML = '';
    toc.append(label, list);
    toc.hidden = false;
  }

  /** Load and render the Markdown file for this article. */
  async function renderContent() {
    const body = document.getElementById('articleBody');
    if (!body) return;

    try {
      const response = await fetch('article_01.md');
      if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
      const raw = await response.text();
      const html = await window.SholynkMarkdown.renderMarkdown(raw);
      body.innerHTML = html;

      // Add loading=lazy to all images rendered from markdown.
      body.querySelectorAll('img').forEach((img) => {
        img.loading = 'lazy';
        img.decoding = 'async';
      });

      // Give the lead paragraph its styling.
      const firstP = body.querySelector('p:first-of-type');
      if (firstP && firstP.previousElementSibling === null) {
        firstP.classList.add('lead');
      }

      buildToc(body);
    } catch (error) {
      console.error('Failed to render article content', error);
      body.innerHTML =
        '<div class="empty-state"><h3>Content unavailable</h3><p>This article could not be loaded. Please try refreshing the page.</p></div>';
    }
  }

  async function init() {
    initReadingProgress();
    await renderContent();
    initEngagement();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
