/**
 * Sholynk CMS client.
 *
 * Pages fetch their content from the CMS API. When the API is unreachable
 * (for example when the folder is opened directly from disk, or the Node
 * server is down) the client falls back to `content-fallback.json`, a snapshot
 * exported from the same database, so the site never renders empty.
 */
window.SholynkCMS = (() => {
  const API_BASE = (window.SHOLYNK_API_BASE || '/api').replace(/\/$/, '');
  const FALLBACK_URL = 'content-fallback.json';

  let fallbackPromise = null;
  // null = unknown, true = live API, false = use the static snapshot.
  let apiAvailable = null;
  let probePromise = null;

  async function loadFallback() {
    if (!fallbackPromise) {
      fallbackPromise = fetch(FALLBACK_URL, { cache: 'no-cache' })
        .then((response) => (response.ok ? response.json() : { articles: [], settings: {} }))
        .catch(() => ({ articles: [], settings: {} }));
    }
    return fallbackPromise;
  }

  /**
   * A static host answers /api/* with its own 404 page, which is
   * indistinguishable from "this article does not exist" unless we probe first.
   */
  async function isApiAvailable() {
    if (apiAvailable !== null) return apiAvailable;
    if (!probePromise) {
      probePromise = fetch(`${API_BASE}/settings`, { headers: { Accept: 'application/json' } })
        .then(async (response) => {
          if (!response.ok) return false;
          const type = response.headers.get('content-type') || '';
          if (!type.includes('application/json')) return false;
          await response.json();
          return true;
        })
        .catch(() => false)
        .then((available) => {
          apiAvailable = available;
          return available;
        });
    }
    return probePromise;
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(detail.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = detail.details;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  function matches(article, { category, q }) {
    const okCategory = !category || category === 'All' || article.category === category;
    const haystack = `${article.title} ${article.category} ${article.subcategory || ''} ${article.description} ${(article.tags || []).join(' ')}`.toLowerCase();
    const okQuery = !q || haystack.includes(String(q).toLowerCase());
    return okCategory && okQuery;
  }

  async function getArticles(params = {}) {
    if (await isApiAvailable()) {
      try {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') search.set(key, value);
        });
        const query = search.toString();
        const payload = await apiRequest(`/articles${query ? `?${query}` : ''}`);
        return payload.data;
      } catch (error) {
        apiAvailable = false;
      }
    }
    const fallback = await loadFallback();
    let list = (fallback.articles || []).filter((article) => matches(article, params));
    if (params.hero) list = list.filter((article) => article.hero);
    if (params.limit) list = list.slice(0, Number(params.limit));
    return list;
  }

  async function getArticle(slugOrId) {
    if (await isApiAvailable()) {
      try {
        const payload = await apiRequest(`/articles/${encodeURIComponent(slugOrId)}`);
        return payload.data;
      } catch (error) {
        if (error.status === 404) return null;
        apiAvailable = false;
      }
    }
    const fallback = await loadFallback();
    return (fallback.articles || []).find(
      (article) => article.slug === slugOrId || String(article.id) === String(slugOrId)
    ) || null;
  }

  async function getAuthors() {
    if (await isApiAvailable()) {
      try {
        const payload = await apiRequest('/authors');
        return payload.data;
      } catch (error) {
        apiAvailable = false;
      }
    }
    return (await loadFallback()).authors || [];
  }

  async function getSettings() {
    if (await isApiAvailable()) {
      try {
        const payload = await apiRequest('/settings');
        return payload.data;
      } catch (error) {
        apiAvailable = false;
      }
    }
    return (await loadFallback()).settings || {};
  }

  /**
   * Forces the next isApiAvailable() call to probe the API again. Used when a
   * page reconnects (e.g. the browser comes back online) so content and
   * engagement data switch back to the live server instead of the snapshot.
   */
  function refreshApiAvailability() {
    apiAvailable = null;
    probePromise = null;
  }

  return {
    API_BASE,
    apiRequest,
    isApiAvailable,
    refreshApiAvailability,
    getArticles,
    getArticle,
    getAuthors,
    getSettings
  };
})();
