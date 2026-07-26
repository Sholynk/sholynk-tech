'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate the test run from the development database.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sholynk-cms-test-'));
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

async function api(path, options) {
  const response = await fetch(`${base}${path}`, {
    headers: options?.body ? { 'Content-Type': 'application/json' } : {},
    ...options
  });
  const body = response.status === 204 ? null : await response.json();
  return { status: response.status, body };
}

test('health endpoint responds', async () => {
  const { status, body } = await api('/healthz');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('full CRUD lifecycle for an article', async () => {
  const created = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Edge computing in 2026',
      category: 'Technology',
      description: 'Why latency is the new bandwidth.',
      body: '<h2>Intro</h2><p>Body text.</p>',
      img: '/uploads/edge.jpg',
      alt: 'Server rack in an edge data centre'
    })
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.slug, 'edge-computing-in-2026');
  assert.equal(created.body.data.link, 'article.html?slug=edge-computing-in-2026');

  const id = created.body.data.id;

  const read = await api(`/api/articles/${id}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.data.title, 'Edge computing in 2026');

  const bySlug = await api('/api/articles/edge-computing-in-2026');
  assert.equal(bySlug.body.data.id, id);

  const updated = await api(`/api/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Edge computing, revisited', status: 'draft' })
  });
  assert.equal(updated.body.data.title, 'Edge computing, revisited');
  assert.equal(updated.body.data.status, 'draft');

  // Drafts are excluded from the default published listing.
  const published = await api('/api/articles');
  assert.ok(!published.body.data.some((article) => article.id === id));

  const drafts = await api('/api/articles?status=draft');
  assert.ok(drafts.body.data.some((article) => article.id === id));

  const removed = await api(`/api/articles/${id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);

  const missing = await api(`/api/articles/${id}`);
  assert.equal(missing.status, 404);
});

test('validation rejects an article without a title', async () => {
  const { status, body } = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({ category: 'Technology' })
  });
  assert.equal(status, 400);
  assert.ok(body.details.some((message) => message.includes('title')));
});

test('duplicate titles receive unique slugs', async () => {
  const payload = JSON.stringify({ title: 'Same Title', category: 'Technology' });
  const first = await api('/api/articles', { method: 'POST', body: payload });
  const second = await api('/api/articles', { method: 'POST', body: payload });
  assert.equal(first.body.data.slug, 'same-title');
  assert.equal(second.body.data.slug, 'same-title-2');
});

test('search and category filters work', async () => {
  await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({ title: 'Zero knowledge proofs explained', category: 'Web 3' })
  });
  const search = await api('/api/articles?q=zero%20knowledge');
  assert.equal(search.body.data.length, 1);

  const category = await api('/api/articles?category=Web%203');
  assert.ok(category.body.data.every((article) => article.category === 'Web 3'));
});

test('image upload stores a file and records metadata', async () => {
  // 1x1 transparent PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), 'pixel.png');
  form.append('alt', 'A single transparent pixel');

  const response = await fetch(`${base}/api/images`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.alt, 'A single transparent pixel');
  assert.ok(data.url.startsWith('/uploads/'));

  const served = await fetch(`${base}${data.url}`);
  assert.equal(served.status, 200);

  const listed = await api('/api/images');
  assert.ok(listed.body.data.some((image) => image.id === data.id));

  const deleted = await api(`/api/images/${data.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
});

test('non-image uploads are rejected', async () => {
  const form = new FormData();
  form.append('image', new Blob(['not an image'], { type: 'text/plain' }), 'notes.txt');
  const response = await fetch(`${base}/api/images`, { method: 'POST', body: form });
  assert.ok(response.status >= 400);
});

test('settings can be read and updated', async () => {
  const before = await api('/api/settings');
  assert.ok(before.body.data.siteTitle);

  const after = await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ homeTagline: 'Fresh tagline' })
  });
  assert.equal(after.body.data.homeTagline, 'Fresh tagline');
});
