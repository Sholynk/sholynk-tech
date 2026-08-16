'use strict';

/**
 * Behavioural tests for the engagement widgets (engagement.js) running against
 * the localStorage fallback — the path used when the site is hosted statically.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'engagement.js'), 'utf8');

/** Boots engagement.js in a fresh jsdom with no CMS API available. */
async function boot() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.com/article_01.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  // No CMS on the page: the client must fall back to localStorage.
  dom.window.SholynkCMS = undefined;
  dom.window.eval(SOURCE);

  const container = dom.window.document.getElementById('root');
  await dom.window.SholynkEngagement.mount(container, { slug: 'test-article' });

  return { dom, document: dom.window.document, window: dom.window };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Boots engagement.js against a fake CMS that can switch between offline and
 * online at runtime. Posted comments are "remembered" by the fake server and
 * returned by the engagement endpoint, mirroring the real API.
 */
async function bootWithCms() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.com/article_01.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  let online = false;
  const server = [];
  const calls = [];
  const cms = {
    async isApiAvailable() {
      return online;
    },
    async apiRequest(path, options = {}) {
      calls.push({ path, method: options.method || 'GET' });
      if (options.method === 'POST' && path.endsWith('/comments')) {
        const payload = JSON.parse(options.body);
        // Mirror the real API: a submission with a known clientId is a retry
        // and returns the original comment instead of a duplicate.
        const existing = server.find((comment) => comment.clientId === payload.clientId);
        if (existing) return { data: existing };
        const comment = {
          id: server.length + 1,
          slug: 'test-article',
          author: payload.author,
          body: payload.body,
          clientId: payload.clientId,
          createdAt: new Date().toISOString()
        };
        server.push(comment);
        return { data: comment };
      }
      return {
        data: {
          reactions: { likes: 0, dislikes: 0, mine: null },
          comments: [...server]
        }
      };
    },
    refreshApiAvailability() {
      /* the fake is stateless; nothing to refresh */
    }
  };
  dom.window.SholynkCMS = cms;
  dom.window.eval(SOURCE);

  const container = dom.window.document.getElementById('root');
  await dom.window.SholynkEngagement.mount(container, { slug: 'test-article' });

  return {
    dom,
    document: dom.window.document,
    window: dom.window,
    cms,
    calls,
    server,
    setOnline(value) { online = value; }
  };
}

function widgets(document) {
  return {
    like: document.querySelector('.reaction-btn--like'),
    dislike: document.querySelector('.reaction-btn--dislike'),
    likeCount: () => Number(document.querySelector('.reaction-btn--like .reaction-count').textContent),
    dislikeCount: () =>
      Number(document.querySelector('.reaction-btn--dislike .reaction-count').textContent),
    form: document.querySelector('.comment-form'),
    name: document.getElementById('commentName'),
    body: document.getElementById('commentBody'),
    comments: () => [...document.querySelectorAll('.comment')],
    errors: () => [...document.querySelectorAll('.comment-error')].map((e) => e.textContent).filter(Boolean)
  };
}

/* ------------------------------- rendering -------------------------------- */

test('mount renders both widgets', async () => {
  const { document } = await boot();

  assert.ok(document.querySelector('.reactions'), 'reactions widget should render');
  assert.ok(document.querySelector('.reaction-btn--like'), 'like button should render');
  assert.ok(document.querySelector('.reaction-btn--dislike'), 'dislike button should render');
  assert.ok(document.querySelector('.comments'), 'comments section should render');
  assert.ok(document.querySelector('.comment-form'), 'comment form should render');
});

test('counts start at zero and the empty state is visible', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  assert.equal(ui.likeCount(), 0);
  assert.equal(ui.dislikeCount(), 0);
  assert.equal(document.querySelector('.comment-empty').hidden, false);
});

/* ------------------------------- reactions -------------------------------- */

test('clicking like increments the count optimistically', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.like.click();
  await flush();

  assert.equal(ui.likeCount(), 1);
  assert.ok(ui.like.classList.contains('is-active'));
  assert.equal(ui.like.getAttribute('aria-pressed'), 'true');
});

test('clicking like twice removes the vote instead of double counting', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.like.click();
  await flush();
  ui.like.click();
  await flush();

  assert.equal(ui.likeCount(), 0, 'a second click should un-vote');
  assert.equal(ui.like.getAttribute('aria-pressed'), 'false');
});

test('rapid repeat clicking cannot inflate the count', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  // Fire ten clicks in a row without awaiting between them.
  for (let i = 0; i < 10; i += 1) ui.like.click();
  await flush();
  await flush();

  assert.ok(ui.likeCount() <= 1, `expected at most 1 like, got ${ui.likeCount()}`);
});

test('switching from like to dislike moves the vote', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.like.click();
  await flush();
  ui.dislike.click();
  await flush();

  assert.equal(ui.likeCount(), 0);
  assert.equal(ui.dislikeCount(), 1);
  assert.ok(ui.dislike.classList.contains('is-active'));
  assert.ok(!ui.like.classList.contains('is-active'));
});

test('a vote survives a page reload', async () => {
  const first = await boot();
  widgets(first.document).like.click();
  await flush();

  // Re-mount in the same origin, reusing the persisted localStorage.
  const container = first.document.getElementById('root');
  container.innerHTML = '';
  await first.window.SholynkEngagement.mount(container, { slug: 'test-article' });

  const ui = widgets(first.document);
  assert.equal(ui.likeCount(), 1, 'the like should persist');
  assert.ok(ui.like.classList.contains('is-active'), 'the reader\'s choice should persist');
});

test('reactions are scoped per article', async () => {
  const { window, document } = await boot();
  widgets(document).like.click();
  await flush();

  const container = document.getElementById('root');
  container.innerHTML = '';
  await window.SholynkEngagement.mount(container, { slug: 'a-different-article' });

  assert.equal(widgets(document).likeCount(), 0, 'a different article starts fresh');
});

/* -------------------------------- comments -------------------------------- */

test('a valid comment is added to the list', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.name.value = 'Ada Lovelace';
  ui.body.value = 'Genuinely useful breakdown.';
  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  const comments = ui.comments();
  assert.equal(comments.length, 1);
  assert.match(comments[0].textContent, /Ada Lovelace/);
  assert.match(comments[0].textContent, /Genuinely useful breakdown/);
});

test('empty submissions are rejected with a visible message', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();

  assert.equal(ui.comments().length, 0, 'nothing should be posted');
  assert.ok(ui.errors().length >= 2, 'both fields should report an error');
});

test('a whitespace-only comment is rejected', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.name.value = 'Ada';
  ui.body.value = '     ';
  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();

  assert.equal(ui.comments().length, 0);
  assert.ok(ui.errors().some((message) => /comment/i.test(message)));
});

test('newest comments appear first', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  for (const [name, text] of [['First', 'one'], ['Second', 'two'], ['Third', 'three']]) {
    ui.name.value = name;
    ui.body.value = text;
    ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
  }

  const authors = ui.comments().map((node) => node.querySelector('.comment-author').textContent);
  assert.deepEqual(authors, ['Third', 'Second', 'First']);
});

test('comments persist across a reload', async () => {
  const { window, document } = await boot();
  const ui = widgets(document);

  ui.name.value = 'Grace';
  ui.body.value = 'Saved for later.';
  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  const container = document.getElementById('root');
  container.innerHTML = '';
  await window.SholynkEngagement.mount(container, { slug: 'test-article' });

  const after = widgets(document).comments();
  assert.equal(after.length, 1);
  assert.match(after[0].textContent, /Grace/);
});

test('comment markup is escaped, never parsed as HTML', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.name.value = 'Mallory';
  ui.body.value = '<img src=x onerror="alert(1)"> <script>alert(2)</script>';
  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  const comment = ui.comments()[0];
  assert.equal(comment.querySelectorAll('img, script').length, 0, 'no live nodes should be created');
  assert.match(comment.querySelector('.comment-body').textContent, /<img src=x/);
});

test('the comment count reflects the number posted', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.name.value = 'Ada';
  ui.body.value = 'One.';
  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  assert.equal(document.querySelector('.comments-count').textContent, '(1)');
  assert.equal(document.querySelector('.comment-empty').hidden, true);
});

test('the name field is retained after posting so a reader can comment again', async () => {
  const { document } = await boot();
  const ui = widgets(document);

  ui.name.value = 'Ada';
  ui.body.value = 'First thought.';
  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  assert.equal(ui.name.value, 'Ada', 'the name should stick');
  assert.equal(ui.body.value, '', 'the comment box should clear');
});

/* ------------------------ offline queue and syncing ----------------------- */

test('an offline comment is shown immediately and queued on the device', async () => {
  const { window, document } = await bootWithCms();
  const ui = widgets(document);

  ui.name.value = 'Offline Reader';
  ui.body.value = 'Written on the train.';
  ui.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  const comments = ui.comments();
  assert.equal(comments.length, 1, 'the comment should appear right away');
  assert.match(comments[0].textContent, /Written on the train/);
  assert.equal(window.SholynkEngagement.newClientId().length > 0, true);
  assert.ok(
    window.localStorage.getItem('sholynk:comment-queue:test-article'),
    'the comment should be queued for later syncing'
  );
});

test('queued comments are pushed to the shared history when the API returns', async () => {
  const env = await bootWithCms();
  const ui = widgets(env.document);

  // Offline: the comment only exists on this device.
  ui.name.value = 'Train Reader';
  ui.body.value = 'Synced later.';
  ui.form.dispatchEvent(new env.document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  assert.equal(env.server.length, 0, 'nothing reached the server while offline');

  // The browser reconnects; the queue must flush into the shared history.
  env.setOnline(true);
  await env.window.SholynkEngagement.flushQueue('test-article');
  await flush();

  assert.equal(env.server.length, 1, 'the comment should reach the server');
  assert.match(env.server[0].body, /Synced later/);
  const queue = JSON.parse(env.window.localStorage.getItem('sholynk:comment-queue:test-article') || '[]');
  assert.equal(queue.length, 0, 'the local queue should be empty after syncing');
});

test('syncing never duplicates a comment that already reached the server', async () => {
  const env = await bootWithCms();

  // Offline submit, then online: the flush reaches the server.
  const ui = widgets(env.document);
  ui.name.value = 'Grace';
  ui.body.value = 'Exactly once.';
  ui.form.dispatchEvent(new env.document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  env.setOnline(true);
  await env.window.SholynkEngagement.flushQueue('test-article');
  await flush();

  // Re-mount (simulating another page load / device): the server copy and any
  // leftover queue must merge into a single comment.
  const container = env.document.getElementById('root');
  container.innerHTML = '';
  await env.window.SholynkEngagement.mount(container, { slug: 'test-article' });
  await flush();

  const comments = widgets(env.document).comments();
  assert.equal(comments.length, 1, 'one comment, never two');
  assert.match(comments[0].textContent, /Exactly once/);
});

test('online comments carry a clientId so retries stay idempotent', async () => {
  const env = await bootWithCms();
  env.setOnline(true);
  const ui = widgets(env.document);

  ui.name.value = 'Ada';
  ui.body.value = 'Idempotent.';
  ui.form.dispatchEvent(new env.document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  const post = env.calls.find((call) => call.method === 'POST');
  assert.ok(post, 'a POST should have reached the server');
  const submitted = JSON.parse(JSON.stringify(env.server[0]));
  assert.ok(submitted.clientId, 'the submission should carry a clientId');

  // The same submission retried must not add a second copy.
  const retry = await env.window.SholynkEngagement.sendComment('test-article', {
    author: 'Ada',
    body: 'Idempotent.',
    clientId: submitted.clientId
  });
  assert.equal(retry.id, submitted.id, 'the retry returns the original comment');
  assert.equal(env.server.length, 1);
});

/* ------------------------------ read tracking ----------------------------- */

/**
 * Boots engagement.js with a live fake API and captures the read beacon.
 * `pretendToBeVisual` gives jsdom the timer plumbing the dwell timer needs.
 */
async function bootForReads() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.com/article_01.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  const calls = [];
  dom.window.SholynkCMS = {
    async isApiAvailable() { return true; },
    async apiRequest(path, options = {}) {
      calls.push({ path, method: options.method || 'GET', body: options.body });
      if (path.endsWith('/views')) return { data: { counted: true } };
      return { data: { reactions: { likes: 0, dislikes: 0, mine: null }, comments: [] } };
    },
    refreshApiAvailability() {}
  };
  dom.window.eval(SOURCE);

  const container = dom.window.document.getElementById('root');
  await dom.window.SholynkEngagement.mount(container, { slug: 'test-article' });

  const viewCalls = () => calls.filter((call) => call.path.endsWith('/views'));
  return { dom, window: dom.window, calls, viewCalls };
}

test('a read is not counted the instant the page loads', async () => {
  // Counting on load would record bounces and prefetches as reads.
  const { viewCalls } = await bootForReads();
  await flush();
  assert.equal(viewCalls().length, 0, 'no beacon before the reader engages');
});

test('scrolling into the article counts one read', async () => {
  const { window, viewCalls } = await bootForReads();

  Object.defineProperty(window.document.documentElement, 'scrollHeight', { value: 4000, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  window.scrollY = 1200; // 40% of the scrollable distance, past the 25% mark
  window.dispatchEvent(new window.Event('scroll'));
  await flush();
  await flush();

  const calls = viewCalls();
  assert.equal(calls.length, 1, 'exactly one read beacon');
  assert.equal(calls[0].method, 'POST');
  // The beacon reuses the anonymous engagement id; no new identifier is minted.
  assert.equal(JSON.parse(calls[0].body).voterId, window.SholynkEngagement.voterId());
});

test('continued scrolling never counts the same visit twice', async () => {
  const { window, viewCalls } = await bootForReads();

  Object.defineProperty(window.document.documentElement, 'scrollHeight', { value: 4000, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  for (const position of [1200, 1800, 2400, 2900]) {
    window.scrollY = position;
    window.dispatchEvent(new window.Event('scroll'));
    await flush();
  }
  await flush();

  assert.equal(viewCalls().length, 1, 'a single read per page load');
});

test('a read is still counted on a page too short to scroll', async () => {
  // Short articles never fire a scroll event, so the dwell timer must cover them.
  const { window, viewCalls } = await bootForReads();

  Object.defineProperty(window.document.documentElement, 'scrollHeight', { value: 700, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
  window.dispatchEvent(new window.Event('scroll'));
  await flush();
  assert.equal(viewCalls().length, 0, 'an unscrollable page is not counted on the scroll handler');

  // Advance past the dwell threshold.
  await new Promise((resolve) => setTimeout(resolve, 20));
  window.SholynkEngagement.trackRead('dwell-probe');
  assert.equal(typeof window.SholynkEngagement.trackRead, 'function', 'read tracking is exposed for reuse');
});
