// Homepage experience: hero slider, searchable article cards, category filters and pagination.
// Content is loaded from the Sholynk CMS API (see cms/) with a static JSON fallback.
(() => {
  // Populated from the CMS before first render.
  let heroSlides = [];
  let articles = [];

  const state = {
    currentSlide: 0,
    heroTimer: null,
    isPaused: false,
    currentPage: 1,
    cardsPerPage: 8,
    query: '',
    category: 'All',
    observer: null
  };

  const selectors = {
    heroSection: document.querySelector('.hero-section'),
    searchInput: document.getElementById('searchInput'),
    cardsContainer: document.getElementById('cardsContainer'),
    prevPageBtn: document.getElementById('prevPage'),
    nextPageBtn: document.getElementById('nextPage'),
    paginationNumbers: document.getElementById('paginationNumbers'),
    categoryFilters: document.getElementById('categoryFilters'),
    clearSearch: document.getElementById('clearSearch'),
    resultsCount: document.getElementById('resultsCount')
  };

  function createIcon(className) {
    const icon = document.createElement('i');
    icon.className = className;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function initHero() {
    const { heroSection } = selectors;
    if (!heroSection) return;

    heroSlides.forEach((slide, index) => {
      const slideEl = document.createElement('section');
      slideEl.className = `hero-slide${index === 0 ? ' active' : ''}`;
      slideEl.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
      slideEl.setAttribute('aria-label', `Featured story ${index + 1} of ${heroSlides.length}`);

      const image = document.createElement('img');
      image.src = slide.img;
      image.alt = slide.alt || '';
      image.decoding = 'async';
      image.loading = index === 0 ? 'eager' : 'lazy';

      const content = document.createElement('div');
      content.className = 'hero-content';

      const category = document.createElement('span');
      category.className = 'hero-kicker';
      category.textContent = slide.category;

      const title = document.createElement('h1');
      title.textContent = slide.title;

      const description = document.createElement('p');
      description.textContent = slide.description;

      const link = document.createElement('a');
      link.href = slide.readMoreLink;
      link.setAttribute('aria-label', `Read more about ${slide.title}`);
      link.textContent = 'Read the story';
      link.append(createIcon('fas fa-arrow-right'));

      content.append(category, title, description, link);
      slideEl.append(image, content);
      heroSection.append(slideEl);
    });

    const controls = document.createElement('div');
    controls.className = 'hero-controls';

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'hero-control';
    previous.setAttribute('aria-label', 'Show previous featured story');
    previous.append(createIcon('fas fa-chevron-left'));

    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'hero-control';
    pause.setAttribute('aria-label', 'Pause featured story autoplay');
    pause.append(createIcon('fas fa-pause'));

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'hero-control';
    next.setAttribute('aria-label', 'Show next featured story');
    next.append(createIcon('fas fa-chevron-right'));

    const dots = document.createElement('div');
    dots.className = 'hero-dots';
    heroSlides.forEach((slide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `hero-dot${index === 0 ? ' active' : ''}`;
      dot.textContent = `${index + 1}`;
      dot.setAttribute('aria-label', `Show featured story: ${slide.title}`);
      dot.addEventListener('click', () => {
        showSlide(index);
        restartHeroTimer();
      });
      dots.append(dot);
    });

    previous.addEventListener('click', () => {
      showSlide(state.currentSlide - 1);
      restartHeroTimer();
    });
    next.addEventListener('click', () => {
      showSlide(state.currentSlide + 1);
      restartHeroTimer();
    });
    pause.addEventListener('click', () => {
      state.isPaused = !state.isPaused;
      pause.setAttribute('aria-label', state.isPaused ? 'Resume featured story autoplay' : 'Pause featured story autoplay');
      pause.innerHTML = '';
      pause.append(createIcon(state.isPaused ? 'fas fa-play' : 'fas fa-pause'));
      restartHeroTimer();
    });

    controls.append(previous, pause, next, dots);
    heroSection.append(controls);
    startHeroTimer();
  }

  function showSlide(nextIndex) {
    const slides = selectors.heroSection?.querySelectorAll('.hero-slide') || [];
    const dots = selectors.heroSection?.querySelectorAll('.hero-dot') || [];
    if (!slides.length) return;

    state.currentSlide = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, index) => {
      const isActive = index === state.currentSlide;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
    dots.forEach((dot, index) => dot.classList.toggle('active', index === state.currentSlide));
  }

  function startHeroTimer() {
    if (state.isPaused) return;
    state.heroTimer = window.setInterval(() => showSlide(state.currentSlide + 1), 6500);
  }

  function restartHeroTimer() {
    window.clearInterval(state.heroTimer);
    startHeroTimer();
  }

  function getCategories() {
    return ['All', ...Array.from(new Set(articles.map((article) => article.category)))];
  }

  function initCategoryFilters() {
    const { categoryFilters } = selectors;
    if (!categoryFilters) return;

    const requestedCategory = new URLSearchParams(window.location.search).get('category');
    if (requestedCategory && getCategories().includes(requestedCategory)) {
      state.category = requestedCategory;
    }

    getCategories().forEach((category) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `category-chip${category === state.category ? ' active' : ''}`;
      chip.dataset.category = category;
      chip.textContent = category;
      chip.addEventListener('click', () => {
        state.category = category;
        state.currentPage = 1;
        updateCategoryUrl(category);
        renderCategoryFilters();
        renderCards();
      });
      categoryFilters.append(chip);
    });
  }

  function renderCategoryFilters() {
    selectors.categoryFilters?.querySelectorAll('.category-chip').forEach((chip) => {
      const isActive = chip.dataset.category === state.category;
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function updateCategoryUrl(category) {
    const url = new URL(window.location.href);
    if (category === 'All') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', category);
    }
    window.history.replaceState({}, '', url.toString());
  }

  function getFilteredArticles() {
    const query = state.query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesCategory = state.category === 'All' || article.category === state.category;
      const haystack = `${article.title} ${article.category} ${article.description}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesQuery;
    });
  }

  function createCard(article, index) {
    const card = document.createElement('a');
    const hasImage = Boolean(article.img);
    const isWeb3NoImage = article.category === 'Web 3' && !hasImage;
    card.href = article.link;
    card.className = `card${isWeb3NoImage ? ' web3-dark' : ''}${article.featured ? ' featured' : ''}`;
    card.setAttribute('role', 'article');
    card.dataset.title = article.title;
    card.dataset.category = article.category;
    card.dataset.index = index.toString();

    if (hasImage) {
      const media = document.createElement('div');
      media.className = 'card-media';
      const image = document.createElement('img');
      image.src = article.img;
      image.alt = article.alt || '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.width = 900;
      image.height = 600;
      image.addEventListener('error', () => {
        image.src = 'photo-1550751827-4bd374c3f58b[1].jpeg';
      }, { once: true });
      media.append(image);
      card.append(media);
    }

    const body = document.createElement('div');
    body.className = 'card-body';

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const category = document.createElement('span');
    category.className = 'category-label';
    category.textContent = article.category;

    const date = document.createElement('span');
    date.textContent = article.date;

    meta.append(category, date);

    const title = document.createElement('h3');
    title.textContent = article.title;

    const description = document.createElement('p');
    description.textContent = article.description;

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const time = document.createElement('span');
    time.textContent = article.readingTime;
    const cta = document.createElement('span');
    cta.textContent = article.link.includes('article.html') ? 'Read more' : 'Explore topic';
    cta.append(createIcon('fas fa-arrow-right'));
    footer.append(time, cta);

    body.append(meta, title, description, footer);
    card.append(body);
    return card;
  }

  function renderCards() {
    const { cardsContainer } = selectors;
    if (!cardsContainer) return;

    const filteredArticles = getFilteredArticles();
    const totalPages = Math.max(1, Math.ceil(filteredArticles.length / state.cardsPerPage));
    state.currentPage = Math.min(state.currentPage, totalPages);

    const start = (state.currentPage - 1) * state.cardsPerPage;
    const pageArticles = filteredArticles.slice(start, start + state.cardsPerPage);

    cardsContainer.innerHTML = '';
    if (!pageArticles.length) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      const title = document.createElement('h3');
      title.textContent = 'No matching articles yet';
      const description = document.createElement('p');
      description.textContent = 'Try a different keyword or choose another category to keep exploring Sholynk.';
      emptyState.append(title, description);
      cardsContainer.append(emptyState);
    } else {
      const fragment = document.createDocumentFragment();
      pageArticles.forEach((article, index) => fragment.append(createCard(article, index)));
      cardsContainer.append(fragment);
    }

    updateResultsCount(filteredArticles.length);
    renderPagination(totalPages);
    observeCards();
  }

  function updateResultsCount(count) {
    if (!selectors.resultsCount) return;
    const articleWord = count === 1 ? 'article' : 'articles';
    const categoryText = state.category === 'All' ? 'all categories' : state.category;
    selectors.resultsCount.textContent = `${count} ${articleWord} in ${categoryText}`;
  }

  function renderPagination(totalPages) {
    const { prevPageBtn, nextPageBtn, paginationNumbers } = selectors;
    if (!prevPageBtn || !nextPageBtn || !paginationNumbers) return;

    prevPageBtn.disabled = state.currentPage <= 1;
    nextPageBtn.disabled = state.currentPage >= totalPages;
    paginationNumbers.innerHTML = '';

    if (totalPages <= 1) return;

    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = page.toString();
      button.className = page === state.currentPage ? 'active' : '';
      button.setAttribute('aria-label', `Go to articles page ${page}`);
      if (page === state.currentPage) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => {
        state.currentPage = page;
        renderCards();
        selectors.cardsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      paginationNumbers.append(button);
    }
  }

  function observeCards() {
    if (state.observer) state.observer.disconnect();
    const cards = document.querySelectorAll('.card');
    if (!('IntersectionObserver' in window)) {
      cards.forEach((card) => card.classList.add('visible'));
      return;
    }

    state.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          state.observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    cards.forEach((card) => state.observer.observe(card));
  }

  function initSearch() {
    const { searchInput, clearSearch, prevPageBtn, nextPageBtn } = selectors;
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        state.query = event.target.value;
        state.currentPage = 1;
        if (clearSearch) clearSearch.hidden = state.query.length === 0;
        renderCards();
      });
    }

    clearSearch?.addEventListener('click', () => {
      state.query = '';
      searchInput.value = '';
      clearSearch.hidden = true;
      state.currentPage = 1;
      renderCards();
      searchInput.focus();
    });

    prevPageBtn?.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage -= 1;
        renderCards();
        selectors.cardsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    nextPageBtn?.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(getFilteredArticles().length / state.cardsPerPage));
      if (state.currentPage < totalPages) {
        state.currentPage += 1;
        renderCards();
        selectors.cardsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    document.querySelector('.search-card')?.addEventListener('submit', (event) => event.preventDefault());
  }

  function toHeroSlide(article) {
    return {
      category: article.category,
      title: article.title,
      description: article.description,
      img: article.img,
      alt: article.alt || '',
      readMoreLink: article.link
    };
  }

  function renderLoadError() {
    const { cardsContainer } = selectors;
    if (!cardsContainer) return;
    cardsContainer.innerHTML = '';
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    const title = document.createElement('h3');
    title.textContent = 'Content is unavailable right now';
    const description = document.createElement('p');
    description.textContent = 'We could not reach the Sholynk content service. Please refresh in a moment.';
    emptyState.append(title, description);
    cardsContainer.append(emptyState);
  }

  async function loadContent() {
    const [allArticles, heroArticles] = await Promise.all([
      window.SholynkCMS.getArticles({ status: 'published' }),
      window.SholynkCMS.getArticles({ status: 'published', hero: true })
    ]);
    articles = allArticles;
    heroSlides = (heroArticles.length ? heroArticles : allArticles.slice(0, 4)).map(toHeroSlide);
  }

  async function applySettings() {
    try {
      const settings = await window.SholynkCMS.getSettings();
      if (settings.siteTitle) document.title = settings.siteTitle;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (settings.siteDescription && metaDescription) {
        metaDescription.setAttribute('content', settings.siteDescription);
      }
      const tagline = document.getElementById('discover-title');
      if (settings.homeTagline && tagline) tagline.textContent = settings.homeTagline;
    } catch (error) {
      console.warn('Unable to apply CMS settings', error);
    }
  }

  async function init() {
    try {
      await loadContent();
    } catch (error) {
      console.error('Unable to load CMS content', error);
      renderLoadError();
      return;
    }

    initHero();
    initCategoryFilters();
    initSearch();
    renderCategoryFilters();
    renderCards();
    applySettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
