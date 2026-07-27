/**
 * Sholynk reader engagement: like/dislike reactions and comments.
 *
 * Mirrors the strategy in cms-client.js — prefer the CMS API, fall back to
 * localStorage when it is unreachable (static hosting, opening the folder from
 * disk, server down). The public API of this module is identical either way, so
 * the widgets below never branch on storage.
 *
 * Exposes `window.SholynkEngagement.mount(container, { slug, title })`, which
 * renders both widgets and wires them up.
 */
window.SholynkEngagement = (() => {
  const VOTER_KEY = 'sholynk:voter-id';
  const REACTION_KEY = (slug) => `sholynk:reactions:${slug}`;
  const COMMENTS_KEY = (slug) => `sholynk:comments:${slug}`;
  const MAX_AUTHOR_LENGTH = 60;
  const MAX_COMMENT_LENGTH = 2000;

  /* ----------------------------- storage ---------------------------------- */

  function safeStorage() {
    try {
      const probe = '__sholynk_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (error) {
      // Private browsing or blocked storage: fall back to a memory shim so the
      // widgets still work for the length of the page view.
      const memory = new Map();
      return {
        getItem: (key) => (memory.has(key) ? memory.get(key) : null),
        setItem: (key, value) => memory.set(key, String(value)),
        removeItem: (key) => memory.delete(key)
      };
    }
  }

  const store = safeStorage();

  function readJson(key, fallback) {
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* Storage full or unavailable — the in-page state is still correct. */
    }
  }

  /** Anonymous, per-browser id. Not authentication: it enforces one vote per reader. */
  function voterId() {
    let id = store.getItem(VOTER_KEY);
    if (!id) {
      id = (window.crypto?.randomUUID?.() || `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      store.setItem(VOTER_KEY, id);
    }
    return id;
  }

  /* ------------------------------- api ------------------------------------ */

  const cms = window.SholynkCMS;

  async function apiAvailable() {
    if (!cms || typeof cms.isApiAvailable !== 'function') return false;
    try {
      // cms-client probes /api/settings once and caches the answer, so this is
      // a single network call per page load no matter how often we ask.
      return await cms.isApiAvailable();
    } catch (error) {
      return false;
    }
  }

  /* --------------------------- local fallback ----------------------------- */

  const local = {
    reactions(slug) {
      const state = readJson(REACTION_KEY(slug), { likes: 0, dislikes: 0, mine: null });
      return {
        slug,
        likes: Number(state.likes) || 0,
        dislikes: Number(state.dislikes) || 0,
        mine: state.mine === 'like' || state.mine === 'dislike' ? state.mine : null
      };
    },

    react(slug, type) {
      const state = local.reactions(slug);

      if (state.mine === type) {
        // Same button again: un-vote.
        if (type === 'like') state.likes = Math.max(0, state.likes - 1);
        else state.dislikes = Math.max(0, state.dislikes - 1);
        state.mine = null;
      } else {
        // Switching sides: remove the previous vote first.
        if (state.mine === 'like') state.likes = Math.max(0, state.likes - 1);
        if (state.mine === 'dislike') state.dislikes = Math.max(0, state.dislikes - 1);
        if (type === 'like') state.likes += 1;
        else state.dislikes += 1;
        state.mine = type;
      }

      writeJson(REACTION_KEY(slug), state);
      return state;
    },

    comments(slug) {
      const list = readJson(COMMENTS_KEY(slug), []);
      return Array.isArray(list) ? list : [];
    },

    addComment(slug, { author, body }) {
      const list = local.comments(slug);
      const comment = {
        id: Date.now(),
        slug,
        author,
        body,
        createdAt: new Date().toISOString()
      };
      // Newest first, matching the server's ORDER BY id DESC.
      const next = [comment, ...list];
      writeJson(COMMENTS_KEY(slug), next);
      return comment;
    }
  };

  /* --------------------------- unified data layer -------------------------- */

  async function getEngagement(slug) {
    if (await apiAvailable()) {
      try {
        const payload = await cms.apiRequest(
          `/articles/${encodeURIComponent(slug)}/engagement?voterId=${encodeURIComponent(voterId())}`
        );
        return payload.data;
      } catch (error) {
        /* Fall through to local state. */
      }
    }
    return { reactions: local.reactions(slug), comments: local.comments(slug) };
  }

  async function sendReaction(slug, type) {
    if (await apiAvailable()) {
      try {
        const payload = await cms.apiRequest(`/articles/${encodeURIComponent(slug)}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, voterId: voterId() })
        });
        return payload.data;
      } catch (error) {
        /* Fall through to local state. */
      }
    }
    return local.react(slug, type);
  }

  async function sendComment(slug, { author, body }) {
    if (await apiAvailable()) {
      try {
        const payload = await cms.apiRequest(`/articles/${encodeURIComponent(slug)}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, body, voterId: voterId() })
        });
        return payload.data;
      } catch (error) {
        /* Fall through to local state. */
      }
    }
    return local.addComment(slug, { author, body });
  }

  /* ------------------------------- helpers -------------------------------- */

  function formatDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) return '';
    const diffMs = Date.now() - parsed.valueOf();
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?';
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  /* ------------------------------ reactions UI ----------------------------- */

  function buildReactions(slug) {
    const section = document.createElement('section');
    section.className = 'reactions';
    section.setAttribute('aria-label', 'Article reactions');

    const prompt = document.createElement('p');
    prompt.className = 'reactions-prompt';
    prompt.textContent = 'Was this article useful?';

    const group = document.createElement('div');
    group.className = 'reaction-buttons';

    function makeButton(type, iconClass, label) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `reaction-btn reaction-btn--${type}`;
      button.dataset.reaction = type;

      const icon = document.createElement('i');
      icon.className = iconClass;
      icon.setAttribute('aria-hidden', 'true');

      const text = document.createElement('span');
      text.className = 'reaction-label';
      text.textContent = label;

      const count = document.createElement('span');
      count.className = 'reaction-count';
      count.textContent = '0';

      button.append(icon, text, count);
      return button;
    }

    const likeButton = makeButton('like', 'fas fa-thumbs-up', 'Like');
    const dislikeButton = makeButton('dislike', 'fas fa-thumbs-down', 'Dislike');

    const status = document.createElement('p');
    status.className = 'reactions-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    group.append(likeButton, dislikeButton);
    section.append(prompt, group, status);

    let current = { likes: 0, dislikes: 0, mine: null };
    let pending = false;

    function paint(state) {
      current = state;
      likeButton.querySelector('.reaction-count').textContent = String(state.likes);
      dislikeButton.querySelector('.reaction-count').textContent = String(state.dislikes);

      likeButton.classList.toggle('is-active', state.mine === 'like');
      dislikeButton.classList.toggle('is-active', state.mine === 'dislike');
      likeButton.setAttribute('aria-pressed', state.mine === 'like' ? 'true' : 'false');
      dislikeButton.setAttribute('aria-pressed', state.mine === 'dislike' ? 'true' : 'false');

      likeButton.setAttribute('aria-label', `Like this article. ${plural(state.likes, 'like')}.`);
      dislikeButton.setAttribute(
        'aria-label',
        `Dislike this article. ${plural(state.dislikes, 'dislike')}.`
      );

      if (state.mine === 'like') status.textContent = 'You liked this article. Click again to undo.';
      else if (state.mine === 'dislike') status.textContent = 'You disliked this article. Click again to undo.';
      else status.textContent = '';
    }

    async function vote(type) {
      // Guard against double-submits while a request is in flight; this is the
      // spam-click protection on top of the one-vote-per-voter rule.
      if (pending) return;
      pending = true;
      group.classList.add('is-busy');

      const previous = { ...current };

      // Optimistic update: recompute locally and paint before the round trip.
      const optimistic = { ...current };
      if (optimistic.mine === type) {
        if (type === 'like') optimistic.likes = Math.max(0, optimistic.likes - 1);
        else optimistic.dislikes = Math.max(0, optimistic.dislikes - 1);
        optimistic.mine = null;
      } else {
        if (optimistic.mine === 'like') optimistic.likes = Math.max(0, optimistic.likes - 1);
        if (optimistic.mine === 'dislike') optimistic.dislikes = Math.max(0, optimistic.dislikes - 1);
        if (type === 'like') optimistic.likes += 1;
        else optimistic.dislikes += 1;
        optimistic.mine = type;
      }
      paint(optimistic);

      try {
        paint(await sendReaction(slug, type));
      } catch (error) {
        // Reconcile: the server is the source of truth, so roll back on failure.
        paint(previous);
        status.textContent = 'Could not save your reaction. Please try again.';
      } finally {
        pending = false;
        group.classList.remove('is-busy');
      }
    }

    likeButton.addEventListener('click', () => vote('like'));
    dislikeButton.addEventListener('click', () => vote('dislike'));

    return { element: section, paint };
  }

  /* ------------------------------- comments UI ----------------------------- */

  function buildComments(slug) {
    const section = document.createElement('section');
    section.className = 'comments';
    section.id = 'comments';
    section.setAttribute('aria-labelledby', 'comments-title');

    const heading = document.createElement('h2');
    heading.className = 'comments-title';
    heading.id = 'comments-title';
    heading.textContent = 'Comments';

    const countLabel = document.createElement('span');
    countLabel.className = 'comments-count';
    heading.append(' ', countLabel);

    /* ------------------------------- form -------------------------------- */

    const form = document.createElement('form');
    form.className = 'comment-form';
    form.noValidate = true; // We render our own messages rather than native bubbles.

    const nameField = document.createElement('div');
    nameField.className = 'comment-field';
    const nameLabel = document.createElement('label');
    nameLabel.setAttribute('for', 'commentName');
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.id = 'commentName';
    nameInput.name = 'name';
    nameInput.type = 'text';
    nameInput.autocomplete = 'name';
    nameInput.placeholder = 'Your name';
    nameInput.maxLength = MAX_AUTHOR_LENGTH;
    const nameError = document.createElement('p');
    nameError.className = 'comment-error';
    nameError.id = 'commentNameError';
    nameField.append(nameLabel, nameInput, nameError);

    const bodyField = document.createElement('div');
    bodyField.className = 'comment-field';
    const bodyLabel = document.createElement('label');
    bodyLabel.setAttribute('for', 'commentBody');
    bodyLabel.textContent = 'Comment';
    const bodyInput = document.createElement('textarea');
    bodyInput.id = 'commentBody';
    bodyInput.name = 'comment';
    bodyInput.rows = 4;
    bodyInput.placeholder = 'Share your thoughts on this article...';
    bodyInput.maxLength = MAX_COMMENT_LENGTH;
    const bodyError = document.createElement('p');
    bodyError.className = 'comment-error';
    bodyError.id = 'commentBodyError';
    bodyField.append(bodyLabel, bodyInput, bodyError);

    const actions = document.createElement('div');
    actions.className = 'comment-actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'comment-submit';
    submit.textContent = 'Post comment';
    const formStatus = document.createElement('p');
    formStatus.className = 'comment-status';
    formStatus.setAttribute('role', 'status');
    formStatus.setAttribute('aria-live', 'polite');
    actions.append(submit, formStatus);

    form.append(nameField, bodyField, actions);

    const list = document.createElement('ol');
    list.className = 'comment-list';

    const empty = document.createElement('p');
    empty.className = 'comment-empty';
    empty.textContent = 'No comments yet. Be the first to share your thoughts.';

    section.append(heading, form, empty, list);

    let comments = [];

    function renderCount() {
      countLabel.textContent = `(${comments.length})`;
      empty.hidden = comments.length > 0;
    }

    function renderComment(comment, { isNew = false } = {}) {
      const item = document.createElement('li');
      item.className = `comment${isNew ? ' is-new' : ''}`;
      if (comment.id != null) item.dataset.commentId = String(comment.id);

      const avatar = document.createElement('div');
      avatar.className = 'comment-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = initials(comment.author);

      const content = document.createElement('div');
      content.className = 'comment-content';

      const header = document.createElement('div');
      header.className = 'comment-header';
      const author = document.createElement('span');
      author.className = 'comment-author';
      // textContent throughout: comment text is never parsed as HTML.
      author.textContent = comment.author;
      const time = document.createElement('time');
      time.className = 'comment-time';
      if (comment.createdAt) time.dateTime = comment.createdAt;
      time.textContent = formatDate(comment.createdAt);
      header.append(author, time);

      const body = document.createElement('p');
      body.className = 'comment-body';
      body.textContent = comment.body;

      content.append(header, body);
      item.append(avatar, content);
      return item;
    }

    function renderAll() {
      list.innerHTML = '';
      const fragment = document.createDocumentFragment();
      comments.forEach((comment) => fragment.append(renderComment(comment)));
      list.append(fragment);
      renderCount();
    }

    function validate() {
      let valid = true;

      if (!nameInput.value.trim()) {
        nameError.textContent = 'Please enter your name.';
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.setAttribute('aria-describedby', nameError.id);
        valid = false;
      } else {
        nameError.textContent = '';
        nameInput.removeAttribute('aria-invalid');
        nameInput.removeAttribute('aria-describedby');
      }

      if (!bodyInput.value.trim()) {
        bodyError.textContent = 'Please write a comment before posting.';
        bodyInput.setAttribute('aria-invalid', 'true');
        bodyInput.setAttribute('aria-describedby', bodyError.id);
        valid = false;
      } else {
        bodyError.textContent = '';
        bodyInput.removeAttribute('aria-invalid');
        bodyInput.removeAttribute('aria-describedby');
      }

      return valid;
    }

    // Clear the error as soon as the reader starts fixing it.
    nameInput.addEventListener('input', () => {
      if (nameInput.value.trim()) {
        nameError.textContent = '';
        nameInput.removeAttribute('aria-invalid');
      }
    });
    bodyInput.addEventListener('input', () => {
      if (bodyInput.value.trim()) {
        bodyError.textContent = '';
        bodyInput.removeAttribute('aria-invalid');
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formStatus.textContent = '';

      if (!validate()) {
        (nameError.textContent ? nameInput : bodyInput).focus();
        return;
      }

      const author = nameInput.value.trim().replace(/\s+/g, ' ');
      const body = bodyInput.value.trim();

      submit.disabled = true;
      submit.textContent = 'Posting...';

      // Optimistic insert so the comment appears immediately.
      const optimistic = {
        id: `pending-${Date.now()}`,
        author,
        body,
        createdAt: new Date().toISOString()
      };
      comments = [optimistic, ...comments];
      const optimisticNode = renderComment(optimistic, { isNew: true });
      list.prepend(optimisticNode);
      renderCount();

      try {
        const saved = await sendComment(slug, { author, body });
        // Swap the placeholder for the stored record (real id, server timestamp).
        comments = comments.map((item) => (item.id === optimistic.id ? saved : item));
        optimisticNode.replaceWith(renderComment(saved, { isNew: true }));
        bodyInput.value = '';
        formStatus.textContent = 'Comment posted. Thanks for joining the conversation.';
      } catch (error) {
        comments = comments.filter((item) => item.id !== optimistic.id);
        optimisticNode.remove();
        renderCount();
        formStatus.textContent = 'Could not post your comment. Please try again.';
      } finally {
        submit.disabled = false;
        submit.textContent = 'Post comment';
      }
    });

    return {
      element: section,
      hydrate(initial) {
        comments = Array.isArray(initial) ? initial : [];
        renderAll();
      }
    };
  }

  /* -------------------------------- mount ---------------------------------- */

  /**
   * Renders the reactions and comments widgets into `container`.
   * `slug` identifies the article; any stable string works.
   */
  async function mount(container, { slug } = {}) {
    if (!container || !slug) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'engagement';

    const reactions = buildReactions(slug);
    const comments = buildComments(slug);
    wrapper.append(reactions.element, comments.element);
    container.append(wrapper);

    try {
      const data = await getEngagement(slug);
      reactions.paint(data.reactions);
      comments.hydrate(data.comments);
    } catch (error) {
      reactions.paint({ likes: 0, dislikes: 0, mine: null });
      comments.hydrate([]);
    }

    return wrapper;
  }

  return { mount, voterId, getEngagement, sendReaction, sendComment };
})();
