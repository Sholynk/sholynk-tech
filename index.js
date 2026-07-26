// Homepage experience: hero slider, searchable article cards, category filters and pagination.
(() => {
  const heroSlides = [
    {
      category: 'Tech Trends',
      title: 'Mastering the art of coding: 10 key areas every developer should focus on',
      description: 'A practical roadmap for turning ideas into reliable software, sharpening your fundamentals, and building habits that compound over time.',
      img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80',
      readMoreLink: 'article_01.html'
    },
    {
      category: 'AI Trends',
      title: 'The future of artificial intelligence in everyday life',
      description: 'From personal assistants to medical triage, AI is moving from novelty into the quiet infrastructure of daily decisions.',
      img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1600&q=80',
      readMoreLink: 'index.html?category=AI%20Trends'
    },
    {
      category: 'Web 3',
      title: 'Decentralized finance is reshaping access to money',
      description: 'Transparent ledgers, programmable assets and community-owned protocols are changing how builders think about finance.',
      img: 'https://images.unsplash.com/photo-1639322537504-6427a16b0a28?auto=format&fit=crop&w=1600&q=80',
      readMoreLink: 'index.html?category=Web%203'
    },
    {
      category: 'Technology',
      title: 'Cybersecurity habits every growing team needs',
      description: 'A modern defense posture starts with simple, repeatable security practices that protect people, products and data.',
      img: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80',
      readMoreLink: 'index.html?category=Technology'
    }
  ];

  const articles = [
    {
      title: 'Mastering the art of coding',
      link: 'article_01.html',
      category: 'Technology',
      description: 'Ten foundational areas every developer should focus on to become more confident, productive and impactful.',
      img: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80',
      alt: 'Developer workstation with code on a monitor',
      date: 'Jul 26, 2026',
      readingTime: '6 min read',
      featured: true
    },
    {
      title: 'The Rise of Quantum Computing',
      link: 'article_01.html',
      category: 'Technology',
      description: 'Quantum computing is set to revolutionize how researchers solve complex optimization and simulation problems.',
      img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=900&q=80',
      alt: 'Glowing blue circuit board representing quantum technology',
      date: 'Jul 24, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Web3 and the Future of the Internet',
      link: 'index.html?category=Web%203',
      category: 'Web 3',
      description: 'Web3 promises a decentralized internet where users control identity, data and digital ownership.',
      img: '',
      alt: '',
      date: 'Jul 22, 2026',
      readingTime: '5 min read'
    },
    {
      title: 'AI in Healthcare: Transforming Patient Care',
      link: 'index.html?category=AI%20Trends',
      category: 'AI Trends',
      description: 'Artificial intelligence is improving diagnostics, treatment planning and patient monitoring workflows.',
      img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80',
      alt: 'Clinician reviewing health data on a tablet',
      date: 'Jul 20, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Breakthroughs in Renewable Energy Tech',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'Solar, wind and battery innovations are accelerating a more resilient clean-energy transition.',
      img: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=80',
      alt: 'Solar panels under a bright sky',
      date: 'Jul 18, 2026',
      readingTime: '3 min read'
    },
    {
      title: 'AI Ethics: Navigating the Challenges',
      link: 'index.html?category=AI%20Trends',
      category: 'AI Trends',
      description: 'Responsible AI requires stronger thinking around bias, privacy, accountability and explainability.',
      img: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=900&q=80',
      alt: 'Human hand interacting with a digital AI interface',
      date: 'Jul 16, 2026',
      readingTime: '5 min read'
    },
    {
      title: 'Decentralized Finance (DeFi) Growth',
      link: 'index.html?category=Web%203',
      category: 'Web 3',
      description: 'DeFi platforms are transforming traditional finance by enabling peer-to-peer financial services.',
      img: '',
      alt: '',
      date: 'Jul 14, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'The Future of Augmented Reality',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'Augmented reality is blending physical and digital experiences across education, retail and gaming.',
      img: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=900&q=80',
      alt: 'Person wearing an augmented reality headset',
      date: 'Jul 12, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Advancements in Remote Work Tech',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'New collaboration platforms are helping distributed teams work faster without sacrificing connection.',
      img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
      alt: 'Team collaborating around laptops',
      date: 'Jul 10, 2026',
      readingTime: '3 min read'
    },
    {
      title: '5G Technology and Its Impact',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'Lower latency and higher bandwidth are creating new opportunities for connected devices and services.',
      img: 'https://images.unsplash.com/photo-1600267165477-6d4cc741b379?auto=format&fit=crop&w=900&q=80',
      alt: 'Telecommunications tower against a blue sky',
      date: 'Jul 8, 2026',
      readingTime: '3 min read'
    },
    {
      title: 'Blockchain Beyond Cryptocurrency',
      link: 'index.html?category=Web%203',
      category: 'Web 3',
      description: 'Supply chains, healthcare and voting systems are using blockchain patterns to increase transparency.',
      img: '',
      alt: '',
      date: 'Jul 6, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Machine Learning in Everyday Life',
      link: 'index.html?category=AI%20Trends',
      category: 'AI Trends',
      description: 'Recommendation engines, fraud detection and smart assistants all depend on machine learning systems.',
      img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
      alt: 'Data visualization dashboard on multiple screens',
      date: 'Jul 4, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Cybersecurity in the Modern Age',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'As threats evolve, resilient security depends on awareness, automation and defense-in-depth strategies.',
      img: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=900&q=80',
      alt: 'Cybersecurity analyst workstation with code and dashboards',
      date: 'Jul 2, 2026',
      readingTime: '5 min read'
    },
    {
      title: 'The Role of IoT in Smart Cities',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'Connected sensors are enabling smarter infrastructure, energy usage and traffic management.',
      img: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80',
      alt: 'Modern city skyline with connected infrastructure concept',
      date: 'Jun 30, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Ethical AI: Balancing Innovation and Responsibility',
      link: 'index.html?category=AI%20Trends',
      category: 'AI Trends',
      description: 'Teams building AI products need governance practices that keep innovation aligned with human outcomes.',
      img: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=900&q=80',
      alt: 'Abstract neural network lines over a person silhouette',
      date: 'Jun 28, 2026',
      readingTime: '5 min read'
    },
    {
      title: 'Virtual Reality in Education',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'Immersive classrooms can help students explore complex ideas through safe, hands-on simulations.',
      img: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&w=900&q=80',
      alt: 'Student using a virtual reality headset',
      date: 'Jun 26, 2026',
      readingTime: '3 min read'
    },
    {
      title: 'Cryptocurrency Regulations Worldwide',
      link: 'index.html?category=Web%203',
      category: 'Web 3',
      description: 'Regulatory clarity is shaping the future of digital assets, exchanges and stablecoin adoption.',
      img: '',
      alt: '',
      date: 'Jun 24, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'AI-Powered Customer Service',
      link: 'index.html?category=AI%20Trends',
      category: 'AI Trends',
      description: 'AI assistants are improving response times while helping support teams focus on complex conversations.',
      img: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=900&q=80',
      alt: 'Customer service professional using a headset at a computer',
      date: 'Jun 22, 2026',
      readingTime: '3 min read'
    },
    {
      title: 'Sustainable Tech Innovations',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'Hardware, software and climate intelligence are reducing waste and supporting greener operations.',
      img: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=900&q=80',
      alt: 'Wind turbines and power lines in a green landscape',
      date: 'Jun 20, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'The Evolution of Cloud Computing',
      link: 'index.html?category=Technology',
      category: 'Technology',
      description: 'Cloud platforms continue to evolve toward faster deployment, elastic infrastructure and edge workloads.',
      img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80',
      alt: 'Earth from space with network connections',
      date: 'Jun 18, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'AI and Automation in Manufacturing',
      link: 'index.html?category=AI%20Trends',
      category: 'AI Trends',
      description: 'Automation powered by AI is increasing precision, quality control and efficiency on factory floors.',
      img: 'https://images.unsplash.com/photo-1565688534245-05d6b5be184a?auto=format&fit=crop&w=900&q=80',
      alt: 'Robotic arm operating in a manufacturing environment',
      date: 'Jun 16, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Cloud Gaming and the Next Console War',
      link: 'index.html?category=Game',
      category: 'Game',
      description: 'Streaming infrastructure, mobile hardware and creator ecosystems are changing how players discover games.',
      img: 'https://images.unsplash.com/photo-1556438064-2d7646166914?auto=format&fit=crop&w=900&q=80',
      alt: 'Gaming controller on a neon-lit desk',
      date: 'Jun 14, 2026',
      readingTime: '4 min read'
    },
    {
      title: 'Stablecoins and the Future of Digital Payments',
      link: 'index.html?category=Cryptocurrency',
      category: 'Cryptocurrency',
      description: 'Stablecoins are becoming a bridge between traditional finance and programmable internet-native money.',
      img: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=900&q=80',
      alt: 'Cryptocurrency coins and a financial chart',
      date: 'Jun 12, 2026',
      readingTime: '5 min read'
    }
  ];

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
      image.alt = '';
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
    cta.textContent = article.link.includes('article') ? 'Read more' : 'Explore topic';
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

  function init() {
    initHero();
    initCategoryFilters();
    initSearch();
    renderCategoryFilters();
    renderCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
