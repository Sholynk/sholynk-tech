// Behaviour for hand-authored article pages (article_01.html).
//
// The CMS-rendered page gets these from article.js. This file provides the same
// two enhancements — the reading progress bar and the engagement widgets — for
// pages whose markup lives in the HTML file itself.
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

  function init() {
    initReadingProgress();
    initEngagement();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
