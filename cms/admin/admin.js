/* Sholynk CMS admin dashboard. Talks to the same /api endpoints as the public site. */
(() => {
  const API = '/api';
  const state = { articles: [], selectedId: null, images: [], authors: [], selectedAuthorId: null };

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
      if (tab.dataset.panel === 'authors') loadAuthors();
      if (tab.dataset.panel === 'media') loadImages();
      if (tab.dataset.panel === 'comments') loadComments();
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
      title: '', category: '', subcategory: '', contentType: 'article', slug: '', description: '',
      hook: '', directAnswer: '', img: '', alt: '', body: '', author: 'Oluwashola Busari',
      authorSlug: 'oluwashola-busari', date: new Date().toISOString().slice(0, 10), readingTime: '', status: 'published',
      scheduledAt: '', reviewNotes: '', heroOrder: '', externalLink: '', canonicalUrl: '',
      featured: false, hero: false, seoTitle: '', seoDescription: '', tags: [],
      keyTakeaways: [], relatedSlugs: [], faqs: [], sources: []
    };

    $('articleId').value = article?.id || '';
    $('formTitle').textContent = article ? `Editing: ${article.title}` : 'New article';
    ['title', 'category', 'subcategory', 'contentType', 'slug', 'description', 'hook',
      'directAnswer', 'img', 'alt', 'body', 'author', 'authorSlug', 'date', 'readingTime', 'status',
      'scheduledAt', 'reviewNotes', 'externalLink', 'canonicalUrl', 'seoTitle', 'seoDescription'].forEach((key) => {
      $(key).value = values[key] ?? '';
    });
    ['tags', 'keyTakeaways', 'relatedSlugs'].forEach((key) => {
      $(key).value = Array.isArray(values[key]) ? values[key].join('\n') : '';
    });
    ['faqs', 'sources'].forEach((key) => {
      $(key).value = JSON.stringify(values[key] || [], null, 2);
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

  function parseLinesOrJson(id) {
    const value = $(id).value.trim();
    if (!value) return [];
    if (value.startsWith('[')) return JSON.parse(value);
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function parseJsonArray(id) {
    const value = $(id).value.trim();
    if (!value) return [];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error(`${id} must be a JSON array`);
    return parsed;
  }

  $('articleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('articleId').value;
    let structured;
    try {
      structured = {
        tags: parseLinesOrJson('tags'),
        keyTakeaways: parseLinesOrJson('keyTakeaways'),
        relatedSlugs: parseLinesOrJson('relatedSlugs'),
        faqs: parseJsonArray('faqs'),
        sources: parseJsonArray('sources')
      };
    } catch (error) {
      toast(`Structured field error: ${error.message}`, true);
      return;
    }
    const payload = {
      title: $('title').value.trim(),
      category: $('category').value.trim(),
      subcategory: $('subcategory').value.trim(),
      contentType: $('contentType').value,
      slug: $('slug').value.trim(),
      description: $('description').value,
      hook: $('hook').value,
      directAnswer: $('directAnswer').value,
      ...structured,
      img: $('img').value.trim(),
      alt: $('alt').value.trim(),
      body: $('body').value,
      author: $('author').value.trim(),
      authorSlug: $('authorSlug').value.trim(),
      date: $('date').value,
      readingTime: $('readingTime').value.trim(),
      status: $('status').value,
      scheduledAt: $('scheduledAt').value,
      reviewNotes: $('reviewNotes').value,
      heroOrder: $('heroOrder').value,
      externalLink: $('externalLink').value.trim(),
      canonicalUrl: $('canonicalUrl').value.trim(),
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
    if (article) window.open(
      article.status === 'published' && article.body
        ? `/articles/${encodeURIComponent(article.slug)}/`
        : `/article.html?slug=${encodeURIComponent(article.slug)}`,
      '_blank',
      'noopener'
    );
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

  /* ------------------------------ authors ------------------------------- */

  function fillAuthorForm(author = null) {
    const values = author || { name: '', slug: '', role: '', bio: '', image: '', imageAlt: '', profileUrl: '' };
    $('authorId').value = author?.id || '';
    $('authorFormTitle').textContent = author ? `Editing: ${author.name}` : 'New author';
    $('authorName').value = values.name || '';
    $('authorEntitySlug').value = values.slug || '';
    $('authorRole').value = values.role || '';
    $('authorBio').value = values.bio || '';
    $('authorImage').value = values.image || '';
    $('authorImageAlt').value = values.imageAlt || '';
    $('authorProfileUrl').value = values.profileUrl || '';
    $('deleteAuthor').hidden = !author;
  }

  function renderAuthors() {
    const list = $('authorList');
    list.innerHTML = '';
    state.authors.forEach((author) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = author.id === state.selectedAuthorId ? 'selected' : '';
      const name = document.createElement('strong');
      name.textContent = author.name;
      const meta = document.createElement('div');
      meta.className = 'row-meta';
      meta.textContent = author.role || author.slug;
      button.append(name, meta);
      button.addEventListener('click', () => {
        state.selectedAuthorId = author.id;
        fillAuthorForm(author);
        renderAuthors();
      });
      item.append(button);
      list.append(item);
    });
  }

  async function loadAuthors() {
    try {
      const payload = await request('/authors');
      state.authors = payload.data || [];
      const options = $('authorOptions');
      options.innerHTML = '';
      state.authors.forEach((author) => {
        const option = document.createElement('option');
        option.value = author.slug;
        option.label = author.name;
        options.append(option);
      });
      renderAuthors();
    } catch (error) {
      toast(error.message, true);
    }
  }

  $('newAuthor').addEventListener('click', () => {
    state.selectedAuthorId = null;
    fillAuthorForm();
    renderAuthors();
    $('authorName').focus();
  });

  $('authorForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('authorId').value;
    const payload = {
      name: $('authorName').value.trim(),
      slug: $('authorEntitySlug').value.trim(),
      role: $('authorRole').value.trim(),
      bio: $('authorBio').value,
      image: $('authorImage').value.trim(),
      imageAlt: $('authorImageAlt').value.trim(),
      profileUrl: $('authorProfileUrl').value.trim()
    };
    if (!payload.slug) delete payload.slug;
    try {
      const response = await request(id ? `/authors/${id}` : '/authors', {
        method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload)
      });
      await loadAuthors();
      state.selectedAuthorId = response.data.id;
      fillAuthorForm(response.data);
      renderAuthors();
      toast(id ? 'Author updated' : 'Author created');
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('deleteAuthor').addEventListener('click', async () => {
    const id = $('authorId').value;
    if (!id || !window.confirm('Delete this author entity? Articles are kept.')) return;
    try {
      await request(`/authors/${id}`, { method: 'DELETE' });
      state.selectedAuthorId = null;
      fillAuthorForm();
      await loadAuthors();
      toast('Author deleted');
    } catch (error) {
      toast(error.message, true);
    }
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

  /* ----------------------------- comments ------------------------------ */

  function formatCommentDate(value) {
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.valueOf())) return value || '';
    return parsed.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  async function loadComments() {
    const list = $('commentList');
    try {
      const payload = await request('/comments?limit=200');
      const comments = payload.data || [];
      list.innerHTML = '';
      $('commentCount').textContent = `${comments.length} comment${comments.length === 1 ? '' : 's'} in the history`;
      if (!comments.length) {
        const empty = document.createElement('p');
        empty.className = 'comment-admin-empty';
        empty.textContent = 'No comments yet. Reader comments will appear here as they are posted.';
        list.append(empty);
        return;
      }
      comments.forEach((comment) => {
        const item = document.createElement('li');
        item.className = 'comment-admin-item';
        item.dataset.commentId = String(comment.id);

        const head = document.createElement('div');
        head.className = 'comment-admin-head';
        const who = document.createElement('span');
        who.className = 'comment-admin-author';
        who.textContent = `${comment.author} · ${comment.articleTitle}`;
        const when = document.createElement('time');
        when.className = 'comment-admin-time';
        when.textContent = formatCommentDate(comment.createdAt);
        head.append(who, when);

        const body = document.createElement('p');
        body.className = 'comment-admin-body';
        body.textContent = comment.body;

        const actions = document.createElement('div');
        actions.className = 'comment-admin-actions';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'danger-button';
        remove.textContent = 'Delete';
        remove.addEventListener('click', async () => {
          if (!window.confirm('Delete this comment permanently?')) return;
          try {
            await request(`/comments/${comment.id}`, { method: 'DELETE' });
            item.remove();
            toast('Comment deleted');
            loadComments();
          } catch (error) {
            toast(error.message, true);
          }
        });
        actions.append(remove);

        item.append(head, body, actions);
        list.append(item);
      });
    } catch (error) {
      toast(error.message, true);
    }
  }

  $('refreshComments').addEventListener('click', loadComments);

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
  loadAuthors();
})();
