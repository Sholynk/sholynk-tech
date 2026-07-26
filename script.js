// Shared enhancements for Sholynk pages: accessible navigation, current year, and small UX fixes.
(() => {
  const pageLinks = {
    home: 'index.html',
    technology: 'index.html?category=Technology',
    ai: 'index.html?category=AI%20Trends',
    cryptocurrency: 'index.html?category=Cryptocurrency',
    'web 3': 'index.html?category=Web%203',
    game: 'index.html?category=Game',
    about: 'about.html',
    contact: 'contact.html',
    'help & support': 'help_&_support.html',
    'privacy policy': 'privacy_policy.html'
  };

  const normalizeText = (text = '') => text.trim().replace(/\s+/g, ' ').toLowerCase();

  function setCopyrightYear() {
    const year = document.getElementById('copyrightYear');
    if (year) year.textContent = new Date().getFullYear().toString();
  }

  function addSkipLink() {
    if (document.querySelector('.skip-link')) return;
    const skipLink = document.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    document.body.prepend(skipLink);

    const main = document.querySelector('main') || document.querySelector('body > section');
    if (main && !main.id) main.id = 'main-content';
    if (main && !main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  }

  function normalizeNavigationLinks() {
    const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const currentCategory = new URLSearchParams(window.location.search).get('category');

    document.querySelectorAll('header nav a, .sidebar a, footer a').forEach((link) => {
      const label = normalizeText(link.textContent);
      if (pageLinks[label]) {
        link.setAttribute('href', pageLinks[label]);
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }

      const href = link.getAttribute('href') || '';
      const linkFile = (href.split('?')[0].split('#')[0] || 'index.html').toLowerCase();
      const linkCategory = href.includes('?') ? new URLSearchParams(href.split('?')[1]).get('category') : null;
      const isCurrentPage = linkFile === currentFile || (currentFile === '' && linkFile === 'index.html');
      const isCurrentCategory = linkCategory && currentCategory && linkCategory.toLowerCase() === currentCategory.toLowerCase();
      const homeWithoutCategory = isCurrentPage && linkFile === 'index.html' && !linkCategory && !currentCategory;

      if ((isCurrentPage && linkFile !== 'index.html') || homeWithoutCategory || isCurrentCategory) {
        link.setAttribute('aria-current', 'page');
        link.closest('li')?.classList.add('highlighted');
      }
    });
  }

  function enhanceSidebar() {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.querySelector('.hamburger');
    if (!sidebar || !hamburger) return;

    const desktopQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 901px)')
      : { matches: false, addEventListener() {}, addListener() {} };

    sidebar.setAttribute('aria-label', 'Mobile navigation');
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.inert = true;

    if (!document.querySelector('.sidebar-close')) {
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'sidebar-close';
      closeButton.setAttribute('aria-label', 'Close navigation menu');
      closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
      sidebar.prepend(closeButton);
    }

    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'sidebar-backdrop';
      backdrop.setAttribute('aria-label', 'Close navigation menu');
      document.body.append(backdrop);
    }

    hamburger.removeAttribute('onclick');
    if (hamburger.tagName !== 'BUTTON') {
      hamburger.setAttribute('role', 'button');
      hamburger.setAttribute('tabindex', '0');
    }
    hamburger.setAttribute('aria-label', 'Open navigation menu');
    hamburger.setAttribute('aria-controls', 'sidebar');
    hamburger.setAttribute('aria-expanded', 'false');

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    window.openSidebar = () => {
      // The off-canvas sidebar is a mobile-only affordance.
      if (desktopQuery.matches) return;
      sidebar.inert = false;
      sidebar.classList.add('active');
      backdrop.classList.add('is-visible');
      document.body.classList.add('sidebar-open');
      sidebar.setAttribute('aria-hidden', 'false');
      hamburger.setAttribute('aria-expanded', 'true');
      sidebar.querySelector(focusableSelector)?.focus({ preventScroll: true });
    };

    window.closeSidebar = () => {
      if (sidebar.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      sidebar.inert = true;
      sidebar.classList.remove('active');
      backdrop.classList.remove('is-visible');
      document.body.classList.remove('sidebar-open');
      sidebar.setAttribute('aria-hidden', 'true');
      hamburger.setAttribute('aria-expanded', 'false');
    };

    window.toggleSidebar = () => {
      if (sidebar.classList.contains('active')) {
        window.closeSidebar();
      } else {
        window.openSidebar();
      }
    };

    const handleDesktopChange = (event) => {
      if (event.matches) window.closeSidebar();
    };
    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', handleDesktopChange);
    } else {
      desktopQuery.addListener(handleDesktopChange);
    }

    hamburger.addEventListener('click', window.toggleSidebar);
    hamburger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.toggleSidebar();
      }
    });

    sidebar.querySelector('.sidebar-close')?.addEventListener('click', window.closeSidebar);
    backdrop.addEventListener('click', window.closeSidebar);

    sidebar.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link) window.closeSidebar();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && sidebar.classList.contains('active')) {
        window.closeSidebar();
        hamburger.focus({ preventScroll: true });
      }
    });
  }

  function enhanceNewsletterForms() {
    document.querySelectorAll('form[name="subscribe"]').forEach((form) => {
      if (form.dataset.enhanced === 'true') return;
      form.dataset.enhanced = 'true';
      form.addEventListener('submit', () => {
        const button = form.querySelector('button[type="submit"]');
        if (button) button.textContent = 'Subscribing...';
      });
    });
  }

  function init() {
    addSkipLink();
    setCopyrightYear();
    normalizeNavigationLinks();
    enhanceSidebar();
    enhanceNewsletterForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
