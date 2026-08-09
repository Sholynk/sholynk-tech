// Article page search helpers. Shared navigation behavior lives in script.js.
(() => {
  let cachedArticles = null;

  async function loadArticles() {
    if (cachedArticles) return cachedArticles;
    try {
      const response = await fetch('articles.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Unable to load articles: ${response.status}`);
      const articles = await response.json();
      cachedArticles = articles.map((article) => ({
        ...article,
        link: normalizeArticleLink(article.link),
        img: normalizeImage(article.img)
      }));
    } catch (error) {
      console.error(error);
      cachedArticles = [];
    }
    return cachedArticles;
  }

  function normalizeArticleLink(link = '') {
    return link || 'index.html';
  }

  function normalizeImage(image = '') {
    return image || 'photo-1550751827-4bd374c3f58b[1].jpeg';
  }

  function createResult(article) {
    const wrapper = document.createElement('article');
    wrapper.className = 'article-search-result';

    const link = document.createElement('a');
    link.href = article.link;

    const image = document.createElement('img');
    image.src = article.img;
    image.alt = article.alt || article.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.src = 'photo-1550751827-4bd374c3f58b[1].jpeg';
    }, { once: true });

    const content = document.createElement('div');

    const category = document.createElement('span');
    category.className = 'category-label';
    category.textContent = article.category || 'Technology';

    const title = document.createElement('h3');
    title.textContent = article.title;

    const description = document.createElement('p');
    description.textContent = article.description;

    content.append(category, title, description);
    link.append(image, content);
    wrapper.append(link);
    return wrapper;
  }

  window.searchItems = async function searchItems() {
    const input = document.getElementById('searchBox');
    const resultsPanel = document.getElementById('searchResults');
    const resultsContainer = document.getElementById('resultsContainer');
    if (!input || !resultsPanel || !resultsContainer) return;

    const query = input.value.trim().toLowerCase();
    resultsContainer.innerHTML = '';

    if (!query) {
      resultsPanel.style.display = 'none';
      resultsPanel.setAttribute('aria-hidden', 'true');
      return;
    }

    const articles = await loadArticles();
    const filteredArticles = articles.filter((article) => {
      const text = `${article.title} ${article.category} ${article.description}`.toLowerCase();
      return text.includes(query);
    }).slice(0, 8);

    resultsPanel.style.display = 'block';
    resultsPanel.setAttribute('aria-hidden', 'false');

    if (!filteredArticles.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-search-message';
      empty.textContent = 'No related articles found. Try a broader keyword.';
      resultsContainer.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    filteredArticles.forEach((article) => fragment.append(createResult(article)));
    resultsContainer.append(fragment);
  };

  window.closeSearchResults = function closeSearchResults() {
    const resultsPanel = document.getElementById('searchResults');
    if (resultsPanel) {
      resultsPanel.style.display = 'none';
      resultsPanel.setAttribute('aria-hidden', 'true');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const resultsPanel = document.getElementById('searchResults');
    const searchBox = document.getElementById('searchBox');
    if (resultsPanel) {
      resultsPanel.setAttribute('role', 'region');
      resultsPanel.setAttribute('aria-label', 'Article search results');
      resultsPanel.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('click', (event) => {
      if (!resultsPanel || !searchBox) return;
      if (!resultsPanel.contains(event.target) && event.target !== searchBox) {
        window.closeSearchResults();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') window.closeSearchResults();
    });
  });
})();
