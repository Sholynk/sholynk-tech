/* Sholynk CMS admin dashboard. Talks to the same /api endpoints as the public site. */
(() => {
  const API = '/api';
  const state = { articles: [], selectedId: null, images: [] };

  const $ = (id) => document.getElementById(id);
  const tokenInput = $('adminToken');
  tokenInput.value = localStorage.getItem('sholynk-admin-token') || '';
  tokenInput.addEventListener('change', () => {
    localStorage.setItem('sholynk-admin-token', tokenInput.value.trim());
  });

  function toast(message, isError = false) {
    const el = $('toast');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = tokenInput.value.trim();
    if (token) headers['x-admin-token'] = token;
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${API}${path}`, { ...options, headers });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error([detail.error, ...(detail.details || [])].filter(Boolean).join(' - ') || `HTTP ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  }

  /* ------------------------------- tabs --------------------------------- */

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((other) => other.classList.toggle('active', other === tab));
      document.querySelectorAll('.panel').forEach((panel) => {
        panel.hidden = panel.id !== `panel-${tab.dataset.panel}`;
      });
      if (tab.dataset.panel === 'media') loadImages();
      if (tab.dataset.panel === 'settings') loadSettings();
    });
  });

  /* ----------------------------- articles ------------------------------- */

  function renderList() {
    const list = $('articleList');
    const query = $('articleSearch').value.trim().toLowerCase();
    const status = $('statusFilter').value;

    const rows = state.articles.filter((article) => {
      const matchesStatus = status === 'all' || article.status === status;
      const haystack = `${article.title} ${article.category} ${article.description}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });

    $('articleCount').textContent = `${rows.length} of ${state.articles.length} articles`;
    list.innerHTML = '';

    rows.forEach((article) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = article.id === state.selectedId ? 'selected' : '';

      const title = document.createElement('strong');
      title.textContent = article.title;

      const meta = document.createElement('div');
      meta.className = 'row-meta';
      const status = document.createElement('span');
      status.className = `pill ${article.status}`;
      status.textContent = article.status;
      meta.append(status);
      if (article.hero) {
        const hero = document.createElement('span');
        hero.className = 'pill hero';
        hero.textContent = 'hero';
        meta.append(hero);
      }
      const info = document.createElement('span');
      info.textContent = `${article.category} - ${article.date}`;
      meta.append(info);

      button.append(title, meta);
      button.addEventListener('click', () => selectArticle(article.id));
      item.append(button);
      list.append(item);
    });
  }

  function fillForm(article) {
    const values = article || {
      title: '', category: '', slug: '', description: '', img: '', alt: '', body: '',
      author: 'Sholynk Editorial', date: new Date().toISOString().slice(0, 10),
      readingTime: '', status: 'published', heroOrder: '', externalLink: '',
      featured: false, hero: false, seoTitle: '', seoDescription: ''
    };

    $('articleId').value = article?.id || '';
    $('formTitle').textContent = article ? `Editing: ${article.title}` : 'New article';
    ['title', 'category', 'slug', 'description', 'img', 'alt', 'body', 'author', 'date',
      'readingTime', 'status', 'externalLink', 'seoTitle', 'seoDescription'].forEach((key) => {
      $(key).value = values[key] ?? '';
    });
    $('heroOrder').value = values.heroOrder ?? '';
    $('featured').checked = Boolean(values.featured);
    $('hero').checked = Boolean(values.hero);
    $('deleteArticle').hidden = !article;
    $('previewArticle').hidden = !article;
    updateImagePreview();
  }

  function updateImagePreview() {
    const url = $('img').value.trim();
    const wrap = $('imagePreview');
    const tag = $('imagePreviewTag');
    if (!url) { wrap.hidden = true; return; }
    tag.src = url;
    tag.alt = $('alt').value.trim() || 'Selected hero image preview';
    wrap.hidden = false;
  }
  $('img').addEventListener('input', updateImagePreview);
  $('alt').addEventListener('input', updateImagePreview);

  function selectArticle(id) {
    state.selectedId = id;
    fillForm(state.articles.find((article) => article.id === id) || null);
    renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadArticles() {
    const payload = await request('/articles?status=all');
    state.articles = payload.data;
    const options = $('categoryOptions');
    options.innerHTML = '';
    [...new Set(state.articles.map((article) => article.category))].forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      options.append(option);
    });
    renderList();
  }

  $('articleSearch').addEventListener('input', renderList);
  $('statusFilter').addEventListener('change', renderList);
  $('newArticle').addEventListener('click', () => {
    state.selectedId = null;
    fillForm(null);
    renderList();
    $('title').focus();
  });

  $('articleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('articleId').value;
    const payload = {
      title: $('title').value.trim(),
      category: $('category').value.trim(),
      slug: $('slug').value.trim(),
      description: $('description').value,
      img: $('img').value.trim(),
      alt: $('alt').value.trim(),
      body: $('body').value,
      author: $('author').value.trim(),
      date: $('date').value,
      readingTime: $('readingTime').value.trim(),
      status: $('status').value,
      heroOrder: $('heroOrder').value,
      externalLink: $('externalLink').value.trim(),
      featured: $('featured').checked,
      hero: $('hero').checked,
      seoTitle: $('seoTitle').value.trim(),
      seoDescription: $('seoDescription').value.trim()
    };
    if (!payload.slug) delete payload.slug;
    if (!payload.readingTime) delete payload.readingTime;

    try {
      const result = id
        ? await request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await request('/articles', { method: 'POST', body: JSON.stringify(payload) });
      await loadArticles();
      selectArticle(result.data.id);
      toast(id ? 'Article updated' : 'Article created');
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('deleteArticle').addEventListener('click', async () => {
    const id = $('articleId').value;
    if (!id) return;
    if (!window.confirm('Delete this article permanently?')) return;
    try {
      await request(`/articles/${id}`, { method: 'DELETE' });
      state.selectedId = null;
      await loadArticles();
      fillForm(null);
      toast('Article deleted');
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('previewArticle').addEventListener('click', () => {
    const article = state.articles.find((item) => item.id === Number($('articleId').value));
    if (article) window.open(`/article.html?slug=${encodeURIComponent(article.slug)}`, '_blank', 'noopener');
  });

  const SNIPPETS = {
    h2: '\n<h2 id="section-id">Section heading</h2>\n<p>Paragraph text.</p>\n',
    figure: '\n<figure>\n  <img src="/uploads/your-image.jpg" alt="Describe the image" loading="lazy" decoding="async"/>\n  <figcaption>Caption explaining the image.</figcaption>\n</figure>\n',
    quote: '\n<blockquote>\n  <p>A memorable pull quote.</p>\n</blockquote>\n',
    list: '\n<ul>\n  <li>First point</li>\n  <li>Second point</li>\n</ul>\n'
  };

  document.querySelectorAll('[data-snippet]').forEach((button) => {
    button.addEventListener('click', () => {
      const textarea = $('body');
      const snippet = SNIPPETS[button.dataset.snippet];
      const start = textarea.selectionStart;
      textarea.value = textarea.value.slice(0, start) + snippet + textarea.value.slice(textarea.selectionEnd);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
    });
  });

  /* ------------------------------ images -------------------------------- */

  async function loadImages() {
    try {
      const payload = await request('/images');
      state.images = payload.data;
      const grid = $('mediaGrid');
      grid.innerHTML = '';
      if (!state.images.length) {
        grid.innerHTML = '<p>No images uploaded yet.</p>';
        return;
      }
      state.images.forEach((image) => {
        const card = document.createElement('div');
        card.className = 'media-card';

        const tag = document.createElement('img');
        tag.src = image.url;
        tag.alt = image.alt || image.filename;
        tag.loading = 'lazy';

        const body = document.createElement('div');
        body.className = 'media-body';
        const name = document.createElement('strong');
        name.textContent = image.filename;
        const alt = document.createElement('input');
        alt.value = image.alt;
        alt.setAttribute('aria-label', `Alt text for ${image.filename}`);
        alt.placeholder = 'Alt text';

        const actions = document.createElement('div');
        actions.className = 'media-actions';

        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.textContent = 'Use as hero';
        useButton.addEventListener('click', () => {
          $('img').value = image.url;
          $('alt').value = alt.value;
          updateImagePreview();
          document.querySelector('.tab[data-panel="articles"]').click();
          toast('Image applied to the open article form');
        });

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = 'Copy URL';
        copyButton.addEventListener('click', () => {
          navigator.clipboard?.writeText(image.url);
          toast('URL copied');
        });

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.textContent = 'Save alt';
        saveButton.addEventListener('click', async () => {
          try {
            await request(`/images/${image.id}`, { method: 'PATCH', body: JSON.stringify({ alt: alt.value }) });
            toast('Alt text saved');
          } catch (error) {
            toast(error.message, true);
          }
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', async () => {
          if (!window.confirm(`Delete ${image.filename}?`)) return;
          try {
            await request(`/images/${image.id}`, { method: 'DELETE' });
            loadImages();
            toast('Image deleted');
          } catch (error) {
            toast(error.message, true);
          }
        });

        actions.append(useButton, copyButton, saveButton, deleteButton);
        body.append(name, alt, actions);
        card.append(tag, body);
        grid.append(card);
      });
    } catch (error) {
      toast(error.message, true);
    }
  }

  $('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = $('imageFile').files[0];
    const alt = $('imageAlt').value.trim();
    if (!file) return toast('Choose an image file first', true);
    if (!alt) return toast('Alt text is required for accessibility', true);

    const form = new FormData();
    form.append('image', file);
    form.append('alt', alt);
    try {
      await request('/images', { method: 'POST', body: form });
      $('uploadForm').reset();
      loadImages();
      toast('Image uploaded');
    } catch (error) {
      toast(error.message, true);
    }
    return undefined;
  });

  /* ----------------------------- settings ------------------------------- */

  async function loadSettings() {
    try {
      const payload = await request('/settings');
      Object.entries(payload.data).forEach(([key, value]) => {
        if ($(key)) $(key).value = value;
      });
    } catch (error) {
      toast(error.message, true);
    }
  }

  $('settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      siteTitle: $('siteTitle').value,
      siteDescription: $('siteDescription').value,
      siteKeywords: $('siteKeywords').value,
      homeTagline: $('homeTagline').value
    };
    try {
      await request('/settings', { method: 'PUT', body: JSON.stringify(payload) });
      toast('Site metadata saved');
    } catch (error) {
      toast(error.message, true);
    }
  });

  /* -------------------------------- boot -------------------------------- */

  fillForm(null);
  loadArticles().catch((error) => toast(error.message, true));
})();
