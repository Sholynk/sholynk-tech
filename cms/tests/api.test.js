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
  assert.equal(created.body.data.link, 'articles/edge-computing-in-2026/');
  assert.equal(created.body.data.cleanLink, 'articles/edge-computing-in-2026/');
  const cleanFallback = await fetch(`${base}/articles/edge-computing-in-2026/`, { redirect: 'manual' });
  assert.equal(cleanFallback.status, 302);
  assert.equal(cleanFallback.headers.get('location'), '/article.html?slug=edge-computing-in-2026');

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

test('hero-filter totals match the filtered result set', async () => {
  await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({ title: 'Hero total test', category: 'Technology', hero: true })
  });
  await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({ title: 'Ordinary total test', category: 'Technology' })
  });

  const allHeroes = await api('/api/articles?hero=true');
  const pagedHeroes = await api('/api/articles?hero=true&limit=1');
  assert.ok(allHeroes.body.data.length >= 1);
  assert.ok(allHeroes.body.data.every((article) => article.hero));
  assert.equal(pagedHeroes.body.total, allHeroes.body.data.length);
});

test('structured editorial fields and sources round-trip through the API', async () => {
  const created = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Structured publishing test',
      category: 'Technology',
      contentType: 'guide',
      subcategory: 'Testing',
      description: 'A structured article.',
      tags: ['testing', 'publishing'],
      directAnswer: 'Structured fields make editorial intent explicit.',
      keyTakeaways: ['Use verified metadata.'],
      faqs: [{ question: 'Does this render?', answer: 'Yes, after generation.' }],
      relatedSlugs: ['edge-computing-in-2026'],
      sources: [{
        title: 'Node.js test runner documentation',
        publisher: 'Node.js',
        url: 'https://nodejs.org/api/test.html',
        type: 'official',
        supports: 'The test runner API used by this repository.'
      }]
    })
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.data.tags, ['testing', 'publishing']);
  assert.equal(created.body.data.sources.length, 1);
  assert.equal(created.body.data.sources[0].type, 'official');

  const id = created.body.data.id;
  const added = await api(`/api/articles/${id}/sources`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Express documentation', url: 'https://expressjs.com/', type: 'reference' })
  });
  assert.equal(added.status, 201);

  const listed = await api(`/api/articles/${id}/sources`);
  assert.equal(listed.body.data.length, 2);

  const removed = await api(`/api/articles/${id}/sources/${added.body.data.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
});

test('author entities support create, update and read operations', async () => {
  const created = await api('/api/authors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Ada Example',
      role: 'Contributing Writer',
      bio: 'Writes verified technology explainers.',
      profileUrl: 'https://example.com/ada'
    })
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.slug, 'ada-example');

  const linkedArticle = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Author linkage test',
      category: 'Technology',
      author: 'Ada Example',
      authorSlug: 'ada-example'
    })
  });

  const updated = await api(`/api/authors/${created.body.data.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'Senior Contributing Writer', slug: 'ada-example-updated' })
  });
  assert.equal(updated.body.data.role, 'Senior Contributing Writer');

  const bySlug = await api('/api/authors/ada-example-updated');
  assert.equal(bySlug.body.data.name, 'Ada Example');
  const linkedAfterRename = await api(`/api/articles/${linkedArticle.body.data.id}`);
  assert.equal(linkedAfterRename.body.data.authorSlug, 'ada-example-updated');
});

test('malformed structured metadata and insecure canonical URLs are rejected', async () => {
  const badSource = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Bad source', category: 'Technology',
      sources: [{ title: 'Placeholder', url: 'not-a-url' }]
    })
  });
  assert.equal(badSource.status, 400);

  const badFaq = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Bad FAQ', category: 'Technology', faqs: [{ question: 'Missing answer' }]
    })
  });
  assert.equal(badFaq.status, 400);

  const badTags = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({ title: 'Bad tags', category: 'Technology', tags: 'not-an-array' })
  });
  assert.equal(badTags.status, 400);

  const insecureCanonical = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Insecure canonical',
      category: 'Technology',
      canonicalUrl: 'http://example.com/insecure'
    })
  });
  assert.equal(insecureCanonical.status, 400);
  assert.ok(insecureCanonical.body.details.some((message) => message.includes('HTTPS')));
});

test('image upload stores a file and records metadata', async () => {
  // 1x1 transparent PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const form = new FormData();
  // The stored extension comes from verified content/MIME, never the supplied
  // filename, so even a misleading original name cannot become executable.
  form.append('image', new Blob([png], { type: 'image/png' }), 'pixel.html');
  form.append('alt', 'A single transparent pixel');

  const response = await fetch(`${base}/api/images`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.alt, 'A single transparent pixel');
  assert.ok(data.url.startsWith('/uploads/'));
  assert.match(data.url, /\.png$/);

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

test('spoofed image MIME headers cannot publish arbitrary files', async () => {
  const form = new FormData();
  form.append(
    'image',
    new Blob(['<script>alert("not an image")</script>'], { type: 'image/png' }),
    'payload.png'
  );
  const response = await fetch(`${base}/api/images`, { method: 'POST', body: form });
  assert.equal(response.status, 400);
  const files = fs.existsSync(process.env.CMS_UPLOAD_DIR)
    ? fs.readdirSync(process.env.CMS_UPLOAD_DIR)
    : [];
  assert.ok(!files.some((file) => file.startsWith('payload-')));
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

test('admin tokens must match in full and protect unpublished content', async () => {
  const draft = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Private draft for token test',
      category: 'Technology',
      status: 'draft',
      body: 'Unpublished copy'
    })
  });
  const prefix = 'a'.repeat(64);
  const expected = `${prefix}-expected`;
  process.env.CMS_ADMIN_TOKEN = expected;

  try {
    const publicArticles = await api('/api/articles');
    assert.equal(publicArticles.status, 200);
    const privateList = await api('/api/articles?status=draft');
    assert.equal(privateList.status, 401);
    const privateArticle = await api(`/api/articles/${draft.body.data.id}`);
    assert.equal(privateArticle.status, 401);
    const authorizedDrafts = await api('/api/articles?status=draft', {
      headers: { 'x-admin-token': expected }
    });
    assert.equal(authorizedDrafts.status, 200);
    assert.ok(authorizedDrafts.body.data.some((article) => article.id === draft.body.data.id));

    const rejected = await api('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': `${prefix}-different`
      },
      body: JSON.stringify({ homeTagline: 'Must not be saved' })
    });
    assert.equal(rejected.status, 401);

    const accepted = await api('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': expected
      },
      body: JSON.stringify({ homeTagline: 'Exact token accepted' })
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.data.homeTagline, 'Exact token accepted');
  } finally {
    delete process.env.CMS_ADMIN_TOKEN;
  }
});

/* ------------------------------ analytics -------------------------------- */

test('article reads are counted once per reader per day', async () => {
  const article = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Read tracking probe',
      category: 'Technology',
      description: 'Verifies the read counter.',
      body: '<p>Body.</p>',
      author: 'Ada Example'
    })
  });
  assert.equal(article.status, 201);
  const slug = article.body.data.slug;

  const first = await api(`/api/articles/${slug}/views`, {
    method: 'POST',
    body: JSON.stringify({ voterId: 'reader-a' })
  });
  assert.equal(first.status, 202);
  assert.equal(first.body.data.counted, true);

  // The same reader refreshing must not inflate the figure.
  const repeat = await api(`/api/articles/${slug}/views`, {
    method: 'POST',
    body: JSON.stringify({ voterId: 'reader-a' })
  });
  assert.equal(repeat.body.data.counted, false);
  assert.equal(repeat.body.data.reason, 'already-counted-today');

  const second = await api(`/api/articles/${slug}/views`, {
    method: 'POST',
    body: JSON.stringify({ voterId: 'reader-b' })
  });
  assert.equal(second.body.data.counted, true);

  const overview = await api('/api/analytics/overview');
  const top = overview.body.data.topArticles.find((item) => item.slug === slug);
  assert.equal(top.views, 2, 'two distinct readers counted');
  assert.equal(top.readers, 2, 'both readers counted as unique');
});

test('reads are rejected for slugs that do not exist', async () => {
  const response = await api('/api/articles/no-such-article-anywhere/views', {
    method: 'POST',
    body: JSON.stringify({ voterId: 'reader-a' })
  });
  // The endpoint is public, so it must not become an open write for any string.
  assert.equal(response.body.data.counted, false);
  assert.equal(response.body.data.reason, 'unknown-article');
});

test('analytics overview reports status counts, authors and engagement', async () => {
  const draft = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Unpublished analytics probe',
      category: 'Technology',
      description: 'A draft used to verify status counts.',
      body: '<p>Body.</p>',
      status: 'draft',
      author: 'Ada Example'
    })
  });
  assert.equal(draft.status, 201);

  const { status, body } = await api('/api/analytics/overview?days=7');
  assert.equal(status, 200);
  const data = body.data;

  // Published and unpublished must always account for every article.
  assert.equal(data.totals.published + data.totals.unpublished, data.totals.articles);
  assert.ok(data.totals.drafts >= 1, 'the draft is counted as unpublished');
  assert.equal(data.trends.days, 7);
  assert.equal(data.series.length, 7, 'the series is zero-filled to the full window');

  // Every day in the window is present, including days with no activity.
  const days = new Set(data.series.map((point) => point.date));
  assert.equal(days.size, 7, 'no duplicate or missing days');

  assert.ok(Array.isArray(data.authors));
  assert.ok(Array.isArray(data.topArticles));
  assert.ok(Array.isArray(data.categories));
  assert.ok(Array.isArray(data.activity));
  assert.equal(data.totals.reactions, data.totals.likes + data.totals.dislikes);
});

test('the author leaderboard counts each author published work and engagement', async () => {
  const created = await api('/api/authors', {
    method: 'POST',
    body: JSON.stringify({ name: 'Leaderboard Author', role: 'Contributor' })
  });
  assert.equal(created.status, 201);
  const authorSlug = created.body.data.slug;

  const article = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Leaderboard probe article',
      category: 'Technology',
      description: 'Counts against one author.',
      body: '<p>Body.</p>',
      author: 'Leaderboard Author',
      authorSlug
    })
  });
  const slug = article.body.data.slug;

  await api(`/api/articles/${slug}/views`, {
    method: 'POST', body: JSON.stringify({ voterId: 'lb-reader' })
  });
  await api(`/api/articles/${slug}/reactions`, {
    method: 'POST', body: JSON.stringify({ voterId: 'lb-voter', type: 'like' })
  });
  await api(`/api/articles/${slug}/comments`, {
    method: 'POST', body: JSON.stringify({ author: 'Reader', body: 'Great piece.' })
  });

  const overview = await api('/api/analytics/overview');
  const row = overview.body.data.authors.find((item) => item.slug === authorSlug);
  assert.ok(row, 'the registered author appears on the leaderboard');
  assert.equal(row.published, 1);
  assert.equal(row.views, 1);
  assert.equal(row.reactions, 1);
  assert.equal(row.comments, 1);
});

test('the live stream announces reader activity to connected dashboards', async () => {
  const article = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Streaming probe',
      category: 'Technology',
      description: 'Verifies the SSE change feed.',
      body: '<p>Body.</p>',
      author: 'Ada Example'
    })
  });
  const slug = article.body.data.slug;

  const controller = new AbortController();
  const response = await fetch(`${base}/api/analytics/stream`, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  async function readUntil(predicate, budgetMs = 5000) {
    const deadline = Date.now() + budgetMs;
    let buffer = '';
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (predicate(buffer)) return buffer;
    }
    return buffer;
  }

  // The stream opens with a ready frame so the client can show "live".
  const opening = await readUntil((text) => text.includes('event: ready'));
  assert.match(opening, /event: ready/);

  await api(`/api/articles/${slug}/comments`, {
    method: 'POST',
    body: JSON.stringify({ author: 'Reader', body: 'Pushed live.' })
  });

  const pushed = await readUntil((text) => text.includes('event: change'));
  assert.match(pushed, /event: change/);
  assert.match(pushed, /"type":"comment"/);

  controller.abort();
});

/* --------------------- analytics data integrity --------------------------- */

test('deleting an article removes the reader history attached to it', async () => {
  const created = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Cleanup probe',
      category: 'Technology',
      description: 'Verifies engagement is not orphaned.',
      body: '<p>Body.</p>',
      author: 'Ada Example'
    })
  });
  const slug = created.body.data.slug;

  await api(`/api/articles/${slug}/views`, { method: 'POST', body: JSON.stringify({ voterId: 'cleanup-reader' }) });
  await api(`/api/articles/${slug}/reactions`, { method: 'POST', body: JSON.stringify({ voterId: 'cleanup-voter', type: 'like' }) });
  await api(`/api/articles/${slug}/comments`, { method: 'POST', body: JSON.stringify({ author: 'R', body: 'A comment.' }) });

  const before = (await api('/api/analytics/overview')).body.data.totals;

  const removed = await api(`/api/articles/${created.body.data.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);

  const after = (await api('/api/analytics/overview')).body.data.totals;
  // Rows keyed by slug do not cascade on their own; left behind they would keep
  // inflating site-wide totals while belonging to no article at all.
  assert.equal(after.views, before.views - 1, 'the read was removed with the article');
  assert.equal(after.reactions, before.reactions - 1, 'the reaction was removed');
  assert.equal(after.comments, before.comments - 1, 'the comment was removed');
});

test('renaming an article keeps its reads, reactions and comments', async () => {
  const created = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Rename probe',
      category: 'Technology',
      description: 'Verifies engagement follows a slug change.',
      body: '<p>Body.</p>',
      author: 'Ada Example'
    })
  });
  const id = created.body.data.id;
  const oldSlug = created.body.data.slug;

  await api(`/api/articles/${oldSlug}/views`, { method: 'POST', body: JSON.stringify({ voterId: 'rename-reader' }) });
  await api(`/api/articles/${oldSlug}/reactions`, { method: 'POST', body: JSON.stringify({ voterId: 'rename-voter', type: 'like' }) });
  await api(`/api/articles/${oldSlug}/comments`, { method: 'POST', body: JSON.stringify({ author: 'R', body: 'Kept please.' }) });

  const renamed = await api(`/api/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ slug: 'rename-probe-updated' })
  });
  assert.equal(renamed.status, 200);
  const newSlug = renamed.body.data.slug;
  assert.notEqual(newSlug, oldSlug);

  const overview = await api('/api/analytics/overview');
  const row = overview.body.data.topArticles.find((item) => item.slug === newSlug);
  assert.ok(row, 'the renamed article is still reported');
  assert.equal(row.views, 1, 'the read followed the rename');
  assert.equal(row.likes, 1, 'the reaction followed the rename');
  assert.equal(row.comments, 1, 'the comment followed the rename');

  // The engagement endpoint must agree with the dashboard.
  const engagement = await api(`/api/articles/${newSlug}/engagement`);
  assert.equal(engagement.body.data.reactions.likes, 1);
  assert.equal(engagement.body.data.comments.length, 1);
});

test('a renamed article keeps its old URL working', async () => {
  const created = await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Redirect probe',
      category: 'Technology',
      description: 'Verifies the old link still resolves.',
      body: '<p>Body.</p>',
      author: 'Ada Example'
    })
  });
  const oldSlug = created.body.data.slug;

  const renamed = await api(`/api/articles/${created.body.data.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ slug: 'redirect-probe-moved' })
  });
  const newSlug = renamed.body.data.slug;

  const response = await fetch(`${base}/articles/${oldSlug}`, { redirect: 'manual' });
  // 301, so an already-indexed link passes its ranking to the new address.
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), `/articles/${newSlug}/`);
});

test('articles with no author profile still reconcile with the headline totals', async () => {
  const author = await api('/api/authors', {
    method: 'POST',
    body: JSON.stringify({ name: 'Departing Author' })
  });
  const authorSlug = author.body.data.slug;

  await api('/api/articles', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Orphan probe',
      category: 'Technology',
      description: 'Its author will be deleted.',
      body: '<p>Body.</p>',
      author: 'Departing Author',
      authorSlug
    })
  });

  // Deleting an author keeps their articles but clears the link.
  await api(`/api/authors/${author.body.data.id}`, { method: 'DELETE' });

  const data = (await api('/api/analytics/overview')).body.data;
  const perAuthorPublished = data.authors.reduce((sum, row) => sum + row.published, 0);
  assert.equal(
    perAuthorPublished,
    data.totals.published,
    'the author table must account for every published article'
  );
  const orphanRow = data.authors.find((row) => row.unattributed);
  assert.ok(orphanRow, 'unattributed articles are reported rather than silently dropped');
  assert.ok(orphanRow.published >= 1);
});

test('the reporting window is always a whole number of days', async () => {
  for (const [requested, expected] of [['1.7', 1], ['0', 30], ['-5', 30], ['abc', 30], ['99999', 365]]) {
    const { body } = await api(`/api/analytics/overview?days=${encodeURIComponent(requested)}`);
    assert.equal(body.data.trends.days, expected, `days=${requested}`);
    assert.equal(
      body.data.series.length,
      expected,
      `the series length must match the period the dashboard reports (days=${requested})`
    );
  }
});
