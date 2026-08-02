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
    cardsPerPage: 10,
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

  const categoryLabels = {
    'AI Trends': 'Artificial Intelligence',
    'Web 3': 'Web3',
    Game: 'Gaming'
  };

  const categoryHeroContent = {
    'AI Trends': [
      {
        title: 'How Artificial Intelligence Is Reshaping Every Industry',
        description: 'From healthcare to finance, education and logistics, AI is becoming the operating layer for faster decisions and smarter services.',
        img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80',
        alt: 'Abstract artificial intelligence network glowing in blue and purple'
      },
      {
        title: 'The Rise of AI Agents: Why They Could Replace Traditional Software',
        description: 'Autonomous AI agents are shifting software from static tools into goal-driven assistants that can plan, execute and adapt.',
        img: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1600&q=80',
        alt: 'Human hand interacting with an artificial intelligence interface'
      },
      {
        title: 'Generative AI vs Predictive AI: Understanding the Difference',
        description: 'Generative models create new content, while predictive systems forecast outcomes. Knowing the difference helps teams pick the right tool.',
        img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
        alt: 'Analytics dashboard representing predictive artificial intelligence'
      },
      {
        title: 'Top AI Trends That Will Define the Next Five Years',
        description: 'Multimodal systems, small specialised models, agentic workflows and AI governance are shaping the next wave of intelligent products.',
        img: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1600&q=80',
        alt: 'Customer support headset beside digital AI interface graphics'
      },
      {
        title: 'AI Ethics in 2026: Innovation Without Compromising Humanity',
        description: 'Responsible AI now means designing for transparency, accountability, privacy and human dignity from the start.',
        img: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=1600&q=80',
        alt: 'Digital face and code representing responsible artificial intelligence'
      }
    ],
    Technology: [
      {
        title: 'The Future of Technology: 10 Innovations That Could Change the World',
        description: 'Breakthroughs in computing, energy, robotics and connectivity are converging into a decade of rapid transformation.',
        img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
        alt: 'Close-up of a circuit board representing emerging technology'
      },
      {
        title: 'Edge Computing vs Cloud Computing: Which Powers the Future?',
        description: 'The next generation of applications will balance cloud scale with edge speed for real-time, data-intensive experiences.',
        img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80',
        alt: 'Earth viewed from space with network lights representing cloud infrastructure'
      },
      {
        title: 'Quantum Computing Explained for Everyone',
        description: 'Qubits, superposition and error correction can sound intimidating, but the core idea is simpler than the hype suggests.',
        img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1600&q=80',
        alt: 'Glowing circuit board representing quantum computing'
      },
      {
        title: 'How Smart Devices Are Building the Internet of Everything',
        description: 'Connected sensors, appliances and infrastructure are turning everyday environments into responsive digital systems.',
        img: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80',
        alt: 'Smart home devices and connected living space'
      },
      {
        title: 'The Biggest Technology Breakthroughs You Should Watch This Year',
        description: 'From sustainable hardware to immersive computing, these innovations show where builders and businesses should pay attention.',
        img: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=1600&q=80',
        alt: 'Person using immersive augmented reality technology'
      }
    ],
    Cryptocurrency: [
      {
        title: 'Cryptocurrency Beyond Bitcoin: What the Future Holds',
        description: 'Digital assets are expanding into payments, infrastructure, tokenized markets and new forms of internet-native coordination.',
        img: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1600&q=80',
        alt: 'Cryptocurrency coin and digital market graphics'
      },
      {
        title: 'Stablecoins Explained: Why They Matter in the Digital Economy',
        description: 'Stablecoins connect traditional money with blockchain rails, making faster settlement and programmable payments possible.',
        img: 'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?auto=format&fit=crop&w=1600&q=80',
        alt: 'Digital currency coins on a financial chart'
      },
      {
        title: 'How Tokenization Is Transforming Real-World Assets',
        description: 'Tokenized property, bonds and commodities could make ownership more transparent, fractional and globally accessible.',
        img: 'https://images.unsplash.com/photo-1639322537504-6427a16b0a28?auto=format&fit=crop&w=1600&q=80',
        alt: 'Blockchain network illustration representing tokenized assets'
      },
      {
        title: 'The Evolution of Digital Money: From Cash to Crypto',
        description: 'Money has moved from paper to cards to mobile wallets, and crypto is the next chapter in programmable value exchange.',
        img: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1600&q=80',
        alt: 'Person using a payment card for digital money transaction'
      },
      {
        title: 'Common Cryptocurrency Scams and How to Avoid Them',
        description: 'Phishing, fake exchanges and too-good-to-be-true investment schemes remain the fastest way new crypto users lose money.',
        img: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=1600&q=80',
        alt: 'Cybersecurity monitoring screen representing crypto scam prevention'
      }
    ],
    'Web 3': [
      {
        title: "Web3 Explained: The Internet's Next Evolution",
        description: 'Web3 combines decentralized networks, digital ownership and community governance into a new model for online platforms.',
        img: 'https://images.unsplash.com/photo-1639322537504-6427a16b0a28?auto=format&fit=crop&w=1600&q=80',
        alt: 'Decentralized blockchain network with glowing nodes'
      },
      {
        title: 'Decentralized Identity: Taking Back Control of Your Digital Life',
        description: 'Self-owned identity systems could reduce password fatigue, limit data exposure and give users more control online.',
        img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80',
        alt: 'Network servers representing decentralized digital identity'
      },
      {
        title: 'The Future of Decentralized Applications (dApps)',
        description: 'dApps are evolving from experiments into usable products across finance, gaming, creator tools and social networks.',
        img: 'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?auto=format&fit=crop&w=1600&q=80',
        alt: 'Developer laptop with blockchain application interface'
      },
      {
        title: 'How Web3 Is Changing Finance, Gaming, and Social Media',
        description: 'Ownership, tokens and open protocols are giving communities new ways to build, fund and govern digital experiences.',
        img: 'https://images.unsplash.com/photo-1556438064-2d7646166914?auto=format&fit=crop&w=1600&q=80',
        alt: 'Gaming controller with colourful light representing Web3 gaming'
      }
    ],
    Game: [
      {
        title: 'The Future of Gaming: AI, Blockchain, and Immersive Virtual Worlds',
        description: 'Games are becoming smarter, more social and more persistent as AI characters, blockchain economies and virtual worlds mature.',
        img: 'https://images.unsplash.com/photo-1556438064-2d7646166914?auto=format&fit=crop&w=1600&q=80',
        alt: 'Gaming controller on a colourful illuminated desk'
      }
    ]
  };

  function createIcon(className) {
    const icon = document.createElement('i');
    icon.className = className;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function getRequestedCategory() {
    return new URLSearchParams(window.location.search).get('category') || '';
  }

  function getCategoryLink(category) {
    return `index.html?category=${encodeURIComponent(category)}`;
  }

  function getCategoryLabel(category) {
    return categoryLabels[category] || category;
  }

  function getStaticCategoryHeroSlides(category) {
    return (categoryHeroContent[category] || []).map((slide) => ({
      ...slide,
      category: getCategoryLabel(category),
      readMoreLink: getCategoryLink(category)
    }));
  }

  function getArticleHeroSlidesForCategory(category) {
    return articles
      .filter((article) => article.category === category)
      .slice(0, 5)
      .map(toHeroSlide);
  }

  function buildHeroSlides(heroArticles, requestedCategory) {
    if (requestedCategory) {
      const staticSlides = getStaticCategoryHeroSlides(requestedCategory);
      if (staticSlides.length) return staticSlides;

      const articleSlides = getArticleHeroSlidesForCategory(requestedCategory);
      if (articleSlides.length) return articleSlides;
    }

    return (heroArticles.length ? heroArticles : articles.slice(0, 4)).map(toHeroSlide);
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
      image.addEventListener('error', () => {
        image.src = 'photo-1550751827-4bd374c3f58b[1].jpeg';
      }, { once: true });

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

  /* Tile pattern for the Pinterest-style masonry grid.
     Each entry defines column span (1 or 2) and row span (3–8).
     The pattern repeats for pages with more than 10 cards. */
  const tilePatterns = [
    { col: 2, row: 5 },  // hero
    { col: 1, row: 6 },  // portrait
    { col: 1, row: 4 },  // square
    { col: 2, row: 3 },  // wide landscape
    { col: 1, row: 5 },  // portrait
    { col: 1, row: 3 },  // landscape
    { col: 1, row: 7 },  // tall portrait
    { col: 2, row: 4 },  // wide square
    { col: 1, row: 4 },  // square
    { col: 1, row: 6 },  // portrait
  ];

  function createCard(article, index) {
    const card = document.createElement('a');
    const hasImage = Boolean(article.img);
    const isWeb3NoImage = article.category === 'Web 3' && !hasImage;
    const pattern = tilePatterns[index % tilePatterns.length];
    card.href = article.link;
    card.className = `card card--col-${pattern.col} card--rows-${pattern.row}${isWeb3NoImage ? ' web3-dark' : ''}`;
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
    const requestedCategory = getRequestedCategory();
    const [allArticles, heroArticles] = await Promise.all([
      window.SholynkCMS.getArticles({ status: 'published' }),
      window.SholynkCMS.getArticles({ status: 'published', hero: true })
    ]);
    articles = allArticles;
    heroSlides = buildHeroSlides(heroArticles, requestedCategory);
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
