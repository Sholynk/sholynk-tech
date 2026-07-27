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
