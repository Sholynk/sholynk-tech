/**
 * Sholynk Markdown renderer.
 *
 * Loads marked.js from CDN and exposes a simple renderMarkdown()
 * function used by article pages to convert .md content to clean
 * HTML matching the article-body CSS class conventions.
 */
window.SholynkMarkdown = (() => {
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js';

  let ready = false;
  let pending = null;

  /** Ensure marked is loaded exactly once. */
  function ensure() {
    if (ready) return Promise.resolve();
    if (pending) return pending;

    pending = new Promise((resolve, reject) => {
      // Already loaded by another page's script tag — shortcut.
      if (typeof marked !== 'undefined' && marked.parse) {
        ready = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = CDN;
      script.onload = () => {
        ready = true;
        // Parsing options only. article.js applies the HTML allowlist before
        // anything returned by marked is inserted into the page.
        if (marked.use) {
          marked.use({ gfm: true, breaks: false });
        }
        resolve();
      };
      script.onerror = () => {
        pending = null;
        reject(new Error('Failed to load Markdown renderer'));
      };
      document.head.append(script);
    });

    return pending;
  }

  /**
   * Convert a Markdown string to safe HTML.
   * Falls back to escaped plain text if marked is unavailable.
   */
  async function renderMarkdown(raw) {
    if (!raw) return '';
    try {
      await ensure();
      if (typeof marked !== 'undefined' && marked.parse) {
        return marked.parse(raw, { async: true });
      }
    } catch (error) {
      // Fall through to plain-text fallback below.
      console.warn('Markdown rendering unavailable, using plain text fallback', error);
    }
    return escapeHtml(raw).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return `<p>${div.innerHTML}</p>`;
  }

  return { renderMarkdown, ensure };
})();
