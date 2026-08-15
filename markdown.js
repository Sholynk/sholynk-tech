/**
 * Sholynk Markdown renderer.
 *
 * Loads marked.js from CDN and exposes a simple renderMarkdown()
 * function used by article pages to convert .md content to clean
 * HTML matching the article-body CSS class conventions.
 */
window.SholynkMarkdown = (() => {
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js';

  // A blocked, throttled or offline CDN must never leave the reader staring at
  // an empty article. `error` only fires for an outright failure — a request
  // that simply never settles would hang forever — so the load is also raced
  // against a timeout, after which the plain-text fallback takes over.
  const LOAD_TIMEOUT_MS = 8000;

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

      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        fn(value);
      };

      const script = document.createElement('script');
      script.src = CDN;
      script.async = true;
      script.onload = () => {
        if (typeof marked === 'undefined' || !marked.parse) {
          pending = null;
          finish(reject, new Error('Markdown renderer loaded but is unusable'));
          return;
        }
        ready = true;
        // Parsing options only. article.js applies the HTML allowlist before
        // anything returned by marked is inserted into the page.
        if (marked.use) {
          marked.use({ gfm: true, breaks: false });
        }
        finish(resolve);
      };
      script.onerror = () => {
        pending = null;
        finish(reject, new Error('Failed to load Markdown renderer'));
      };

      const timer = window.setTimeout(() => {
        pending = null;
        finish(reject, new Error('Timed out loading Markdown renderer'));
      }, LOAD_TIMEOUT_MS);

      document.head.append(script);
    });

    return pending;
  }

  /**
   * Convert a Markdown string to safe HTML.
   * Falls back to a minimal built-in renderer if marked is unavailable.
   */
  async function renderMarkdown(raw) {
    if (!raw) return '';
    try {
      await ensure();
      if (typeof marked !== 'undefined' && marked.parse) {
        return marked.parse(raw, { async: true });
      }
    } catch (error) {
      // Fall through to the offline fallback below.
      console.warn('Markdown rendering unavailable, using built-in fallback', error);
    }
    return basicMarkdown(raw);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /** Inline spans: images, links, code, bold and italic. */
  function inline(text) {
    let out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '<img src="$2" alt="$1" />');
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a href="$2">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return out;
  }

  /**
   * Enough Markdown to keep a story readable and navigable without the CDN.
   *
   * Headings matter beyond looks: the table of contents is built from the H2
   * elements in the rendered body, so emitting real headings here keeps in-page
   * navigation working when the renderer cannot be fetched.
   */
  function basicMarkdown(raw) {
    const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let list = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!list) return;
      html.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`);
      list = null;
    };
    const flushAll = () => { flushParagraph(); flushList(); };

    for (const line of lines) {
      if (!line.trim()) { flushAll(); continue; }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushAll();
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
        continue;
      }

      if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { flushAll(); html.push('<hr />'); continue; }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) { flushAll(); html.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`); continue; }

      const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (unordered || ordered) {
        flushParagraph();
        const tag = unordered ? 'ul' : 'ol';
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push((unordered || ordered)[1]);
        continue;
      }

      flushList();
      paragraph.push(line.trim());
    }

    flushAll();
    return html.join('\n');
  }

  return { renderMarkdown, ensure };
})();
