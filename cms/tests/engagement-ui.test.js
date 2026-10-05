'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'engagement.js'), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function createCms({ fail = false } = {}) {
  const calls = [];
  const comments = [];
  const voters = new Map();
  let likes = 0;
  let dislikes = 0;

  return {
    calls,
    comments,
    async apiRequest(requestPath, options = {}) {
      calls.push({ path: requestPath, method: options.method || 'GET', body: options.body });
      if (fail) throw new Error('network unavailable');
      const payload = options.body ? JSON.parse(options.body) : {};
      if (requestPath.endsWith('/reactions')) {
        const previous = voters.get(payload.voterId) || null;
        let next = payload.type;
        if (previous === payload.type) next = null;
        if (previous === 'like') likes -= 1;
        if (previous === 'dislike') dislikes -= 1;
        if (next === 'like') likes += 1;
        if (next === 'dislike') dislikes += 1;
        if (next) voters.set(payload.voterId, next); else voters.delete(payload.voterId);
        return { data: { likes, dislikes, mine: next } };
      }
      if (requestPath.endsWith('/comments')) {
        const existing = comments.find((item) => item.clientId === payload.clientId);
        if (existing) return { data: existing };
        const comment = {
          id: comments.length + 1,
          author: payload.author,
          body: payload.body,
          clientId: payload.clientId,
          createdAt: new Date().toISOString()
        };
        comments.unshift(comment);
        return { data: comment };
      }
      if (requestPath.endsWith('/views')) return { data: { counted: true } };
      const voter = new URL(requestPath, 'https://example.com').searchParams.get('voterId');
      return {
        data: {
          reactions: { likes, dislikes, mine: voters.get(voter) || null },
          comments: [...comments]
        }
      };
    }
  };
}

async function boot(cms = createCms()) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.com/articles/test-article/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  dom.window.SholynkCMS = cms;
  dom.window.eval(SOURCE);
  const container = dom.window.document.getElementById('root');
  await dom.window.SholynkEngagement.mount(container, { slug: 'test-article' });
  return { dom, window: dom.window, document: dom.window.document, cms };
}

function ui(document) {
  return {
    like: document.querySelector('.reaction-btn--like'),
    dislike: document.querySelector('.reaction-btn--dislike'),
    likeCount: () => Number(document.querySelector('.reaction-btn--like .reaction-count').textContent),
    dislikeCount: () => Number(document.querySelector('.reaction-btn--dislike .reaction-count').textContent),
    form: document.querySelector('.comment-form'),
    name: document.getElementById('commentName'),
    body: document.getElementById('commentBody'),
    submit: document.querySelector('.comment-submit'),
    status: document.querySelector('.comment-status'),
    comments: () => [...document.querySelectorAll('.comment')]
  };
}

test('mount hydrates reactions and comments from the live API', async () => {
  const { document, cms } = await boot();
  const widgets = ui(document);
  assert.ok(document.querySelector('.reactions'));
  assert.ok(document.querySelector('.comments'));
  assert.equal(widgets.likeCount(), 0);
  assert.equal(widgets.comments().length, 0);
  assert.match(cms.calls[0].path, /\/engagement\?voterId=/);
});

test('reaction clicks are reconciled with the server response', async () => {
  const { document } = await boot();
  const widgets = ui(document);
  widgets.like.click();
  await flush();
  assert.equal(widgets.likeCount(), 1);
  assert.equal(widgets.like.getAttribute('aria-pressed'), 'true');

  widgets.like.click();
  await flush();
  assert.equal(widgets.likeCount(), 0);
  assert.equal(widgets.like.getAttribute('aria-pressed'), 'false');

  widgets.dislike.click();
  await flush();
  assert.equal(widgets.dislikeCount(), 1);
});

test('valid comments are saved by the API and rendered as text', async () => {
  const { document, cms } = await boot();
  const widgets = ui(document);
  widgets.name.value = 'Ada';
  widgets.body.value = '<img src=x onerror=alert(1)> useful story';
  widgets.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();

  assert.equal(cms.comments.length, 1);
  assert.equal(widgets.comments().length, 1);
  assert.equal(document.querySelector('.comment-body').textContent,
    '<img src=x onerror=alert(1)> useful story');
  assert.equal(document.querySelector('.comment-body img'), null);
  assert.match(widgets.status.textContent, /Comment posted/);
});

test('invalid comments stay client-side and are not submitted', async () => {
  const { document, cms } = await boot();
  const widgets = ui(document);
  widgets.form.dispatchEvent(new document.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  assert.equal(cms.calls.filter((call) => call.path.endsWith('/comments')).length, 0);
  assert.match(document.getElementById('commentNameError').textContent, /enter your name/);
});

test('an API failure disables live controls instead of creating local content', async () => {
  const { window, document } = await boot(createCms({ fail: true }));
  const widgets = ui(document);
  assert.equal(widgets.like.disabled, true);
  assert.equal(widgets.submit.disabled, true);
  assert.match(document.querySelector('.reactions-status').textContent, /temporarily unavailable/);

  const keys = Object.keys(window.localStorage);
  assert.equal(keys.some((key) => /reactions|comments|queue/.test(key)), false);
  assert.ok(keys.includes('sholynk:voter-id'));
});

test('module exposes no offline queue API', async () => {
  const { window } = await boot();
  assert.equal(window.SholynkEngagement.flushQueue, undefined);
  assert.equal(typeof window.SholynkEngagement.sendComment, 'function');
  assert.equal(typeof window.SholynkEngagement.sendReaction, 'function');
});
