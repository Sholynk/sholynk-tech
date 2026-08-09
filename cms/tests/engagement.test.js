'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate the test run from the development database.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sholynk-engagement-test-'));
process.env.CMS_DATA_DIR = tmp;
process.env.CMS_DB_FILE = path.join(tmp, 'test.sqlite');
process.env.CMS_UPLOAD_DIR = path.join(tmp, 'uploads');
delete process.env.CMS_ADMIN_TOKEN;

const app = require('../server');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function api(pathname, options) {
  const response = await fetch(`${base}${pathname}`, {
    headers: options?.body ? { 'Content-Type': 'application/json' } : {},
    ...options
  });
  const body = response.status === 204 ? null : await response.json();
  return { status: response.status, body };
}

const react = (slug, voterId, type) =>
  api(`/api/articles/${slug}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ voterId, type })
  });

/* ------------------------------- reactions -------------------------------- */

test('reactions start empty for an unknown article', async () => {
  const { status, body } = await api('/api/articles/fresh-article/reactions?voterId=v1');
  assert.equal(status, 200);
  assert.deepEqual(body.data, { slug: 'fresh-article', likes: 0, dislikes: 0, mine: null });
});

test('a like is recorded and reported back to its voter', async () => {
  const { status, body } = await react('likes-demo', 'voter-a', 'like');
  assert.equal(status, 200);
  assert.equal(body.data.likes, 1);
  assert.equal(body.data.dislikes, 0);
  assert.equal(body.data.mine, 'like');
});

test('repeat clicks from one voter cannot inflate the count', async () => {
  await react('spam-demo', 'voter-a', 'like');
  await react('spam-demo', 'voter-a', 'like'); // un-votes
  await react('spam-demo', 'voter-a', 'like'); // votes again
  const { body } = await api('/api/articles/spam-demo/reactions?voterId=voter-a');

  // Three clicks from one reader still amount to a single like.
  assert.equal(body.data.likes, 1);
  assert.equal(body.data.mine, 'like');
});

test('clicking the same reaction twice removes it', async () => {
  await react('toggle-demo', 'voter-a', 'like');
  const { body } = await react('toggle-demo', 'voter-a', 'like');
  assert.equal(body.data.likes, 0);
  assert.equal(body.data.mine, null);
});

test('switching from like to dislike moves the vote rather than adding one', async () => {
  await react('switch-demo', 'voter-a', 'like');
  const { body } = await react('switch-demo', 'voter-a', 'dislike');
  assert.equal(body.data.likes, 0);
  assert.equal(body.data.dislikes, 1);
  assert.equal(body.data.mine, 'dislike');
});

test('separate voters each get their own vote', async () => {
  await react('crowd-demo', 'voter-a', 'like');
  await react('crowd-demo', 'voter-b', 'like');
  await react('crowd-demo', 'voter-c', 'dislike');

  const { body } = await api('/api/articles/crowd-demo/reactions?voterId=voter-b');
  assert.equal(body.data.likes, 2);
  assert.equal(body.data.dislikes, 1);
  assert.equal(body.data.mine, 'like');

  // A reader who has not voted sees the totals but no selection of their own.
  const anonymous = await api('/api/articles/crowd-demo/reactions?voterId=voter-z');
  assert.equal(anonymous.body.data.mine, null);
});

test('reaction validation rejects a bad type or a missing voter', async () => {
  const badType = await react('validation-demo', 'voter-a', 'shrug');
  assert.equal(badType.status, 400);

  const noVoter = await api('/api/articles/validation-demo/reactions', {
    method: 'POST',
    body: JSON.stringify({ type: 'like' })
  });
  assert.equal(noVoter.status, 400);
});

test('reactions on one article do not leak into another', async () => {
  await react('article-one', 'voter-a', 'like');
  const other = await api('/api/articles/article-two/reactions?voterId=voter-a');
  assert.equal(other.body.data.likes, 0);
  assert.equal(other.body.data.mine, null);
});

/* -------------------------------- comments -------------------------------- */

test('a comment can be posted and read back, newest first', async () => {
  const first = await api('/api/articles/comments-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'First comment.' })
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.author, 'Ada');

  await api('/api/articles/comments-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Grace', body: 'Second comment.' })
  });

  const { body } = await api('/api/articles/comments-demo/comments');
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].author, 'Grace', 'newest comment should come first');
  assert.equal(body.data[1].author, 'Ada');
});

test('empty submissions are rejected', async () => {
  const noBody = await api('/api/articles/validation-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: '   ' })
  });
  assert.equal(noBody.status, 400);
  assert.ok(noBody.body.details.some((message) => message.includes('comment')));

  const noAuthor = await api('/api/articles/validation-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: '', body: 'Anonymous thoughts.' })
  });
  assert.equal(noAuthor.status, 400);
  assert.ok(noAuthor.body.details.some((message) => message.includes('name')));
});

test('an over-long comment is rejected', async () => {
  const { status } = await api('/api/articles/validation-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'x'.repeat(2001) })
  });
  assert.equal(status, 400);
});

test('comment text is stored verbatim, not interpreted', async () => {
  const payload = '<script>alert(1)</script> hello';
  const created = await api('/api/articles/escaping-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Mallory', body: payload })
  });

  // The API stores what was submitted; the front-end renders it with
  // textContent, so the markup is never parsed as HTML.
  assert.equal(created.body.data.body, payload);
});

test('posting the same clientId twice returns the original comment', async () => {
  const first = await api('/api/articles/idempotent-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'Sync-safe comment.', clientId: 'client-abc-123' })
  });
  assert.equal(first.status, 201);

  // A retried submission (offline queue sync, double-tab, timeout retry) must
  // not create a second copy of the same comment.
  const retry = await api('/api/articles/idempotent-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'Sync-safe comment.', clientId: 'client-abc-123' })
  });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.data.id, first.body.data.id);
  assert.equal(retry.body.data.clientId, 'client-abc-123');

  const { body } = await api('/api/articles/idempotent-demo/comments');
  assert.equal(body.data.length, 1);
});

test('different clientIds are stored as separate comments', async () => {
  await api('/api/articles/idempotent-demo-2/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'One.', clientId: 'client-1' })
  });
  await api('/api/articles/idempotent-demo-2/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'Two.', clientId: 'client-2' })
  });

  const { body } = await api('/api/articles/idempotent-demo-2/comments');
  assert.equal(body.data.length, 2);
});

test('the admin comments endpoint lists the full history across articles', async () => {
  await api('/api/articles/history-a/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Alice', body: 'On article A.', clientId: 'hist-a-1' })
  });
  await api('/api/articles/history-b/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Bob', body: 'On article B.', clientId: 'hist-b-1' })
  });

  const { status, body } = await api('/api/comments');
  assert.equal(status, 200);
  const mine = body.data.filter((comment) =>
    comment.articleSlug === 'history-a' || comment.articleSlug === 'history-b'
  );
  assert.equal(mine.length, 2);
  assert.ok(mine.every((comment) => comment.articleTitle), 'each row carries the article title');
  assert.equal(mine[0].body, 'On article B.', 'newest first across articles');
});

test('comments are scoped to their article', async () => {
  await api('/api/articles/scoped-one/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'Only here.' })
  });
  const other = await api('/api/articles/scoped-two/comments');
  assert.equal(other.body.data.length, 0);
});

test('a comment can be deleted', async () => {
  const created = await api('/api/articles/delete-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'Remove me.' })
  });
  const removed = await api(`/api/comments/${created.body.data.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);

  const { body } = await api('/api/articles/delete-demo/comments');
  assert.equal(body.data.length, 0);
});

/* ------------------------------- combined --------------------------------- */

test('the engagement endpoint returns reactions and comments together', async () => {
  await react('summary-demo', 'voter-a', 'like');
  await api('/api/articles/summary-demo/comments', {
    method: 'POST',
    body: JSON.stringify({ author: 'Ada', body: 'Nice piece.' })
  });

  const { status, body } = await api('/api/articles/summary-demo/engagement?voterId=voter-a');
  assert.equal(status, 200);
  assert.equal(body.data.reactions.likes, 1);
  assert.equal(body.data.reactions.mine, 'like');
  assert.equal(body.data.comments.length, 1);
  assert.equal(body.data.comments[0].author, 'Ada');
});

test('engagement routes do not shadow the single-article route', async () => {
  // /api/articles/:idOrSlug must still resolve for a real article.
  const created = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({ title: 'Routing check', category: 'Technology' })
  });
  assert.equal(created.status, 201);

  const fetched = await api('/api/articles/routing-check');
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.data.title, 'Routing check');
});
