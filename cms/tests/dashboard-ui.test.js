'use strict';

/**
 * Admin analytics dashboard UI.
 *
 * The panel is booted in jsdom against a stubbed /api so the rendering logic is
 * exercised without a server. Chart.js is not loaded here: these tests cover
 * the figures, tables and resilience, which must be correct whether or not the
 * chart library is available.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const ADMIN_HTML = fs.readFileSync(path.join(ROOT, 'cms', 'admin', 'index.html'), 'utf8');
const ADMIN_JS = fs.readFileSync(path.join(ROOT, 'cms', 'admin', 'admin.js'), 'utf8');

function sampleOverview(overrides = {}) {
  const series = Array.from({ length: 7 }, (_, index) => ({
    date: `2026-08-${String(10 + index).padStart(2, '0')}`,
    views: index * 3,
    readers: index * 2,
    comments: index,
    reactions: index + 1,
    published: index % 2
  }));

  return {
    generatedAt: '2026-08-16T12:00:00.000Z',
    totals: {
      articles: 12,
      published: 8,
      unpublished: 4,
      drafts: 2,
      scheduled: 1,
      pending: 1,
      otherStatus: 0,
      authors: 2,
      views: 340,
      readers: 210,
      likes: 40,
      dislikes: 6,
      reactions: 46,
      comments: 18,
      images: 5
    },
    statuses: { published: 8, draft: 2, scheduled: 1, pending: 1, other: 0 },
    trends: {
      days: 7,
      views: { current: 120, previous: 100, change: 20 },
      comments: { current: 8, previous: 10, change: -20 },
      reactions: { current: 12, previous: 0, change: null },
      published: { current: 3, previous: 2, change: 50 }
    },
    series,
    authors: [
      {
        id: 1, slug: 'oluwashola-busari', name: 'Oluwashola Busari',
        role: 'Founder', image: 'Images and Assets/my_pic.png', imageAlt: 'Portrait',
        registeredAt: '2026-01-01 00:00:00',
        articles: 9, published: 7, drafts: 1, pending: 1, scheduled: 0,
        views: 300, reactions: 40, comments: 15
      },
      {
        id: 2, slug: 'ada-example', name: 'Ada Example',
        role: 'Contributor', image: '', imageAlt: '',
        registeredAt: '2026-02-01 00:00:00',
        articles: 3, published: 1, drafts: 1, pending: 0, scheduled: 1,
        views: 40, reactions: 6, comments: 3
      }
    ],
    topArticles: [
      { slug: 'a', title: 'Alpha story', category: 'Technology', status: 'published', author: 'Oluwashola Busari', authorSlug: 'oluwashola-busari', views: 200, readers: 150, likes: 20, dislikes: 2, comments: 9 },
      { slug: 'b', title: 'Beta story', category: 'AI Trends', status: 'published', author: 'Ada Example', authorSlug: 'ada-example', views: 40, readers: 30, likes: 4, dislikes: 0, comments: 2 }
    ],
    categories: [
      { category: 'Technology', articles: 6, views: 220 },
      { category: 'AI Trends', articles: 3, views: 90 }
    ],
    activity: [
      { type: 'comment', at: '2026-08-16 11:59:00', title: 'Alpha story', slug: 'a', detail: 'Ada commented', body: 'Very clear.' },
      { type: 'like', at: '2026-08-16 11:58:00', title: 'Beta story', slug: 'b', detail: 'A reader liked this' }
    ],
    ...overrides
  };
}

/**
 * Boots the admin page with a stubbed API.
 * `chart` controls what window.Chart is: undefined (CDN blocked), or a
 * constructor that throws (canvas unavailable).
 */
async function bootDashboard({ overview = sampleOverview(), chart } = {}) {
  const dom = new JSDOM(ADMIN_HTML, {
    url: 'http://localhost:3000/admin/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;

  window.EventSource = class {
    constructor() { this.readyState = 1; }
    addEventListener() {}
    close() {}
  };
  window.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('/analytics/overview')
      ? { data: overview }
      : { data: [] })
  });
  if (chart) window.Chart = chart;

  window.eval(ADMIN_JS);
  await new Promise((resolve) => setTimeout(resolve, 60));
  return { dom, window, document: window.document };
}

const metricByLabel = (document, label) =>
  [...document.querySelectorAll('#dashMetrics .metric-card')]
    .find((card) => card.querySelector('.metric-label').textContent === label);

test('the dashboard is the tab the admin opens on', async () => {
  const { document } = await bootDashboard();
  const first = document.querySelector('.tab');
  assert.equal(first.dataset.panel, 'dashboard');
  assert.ok(first.classList.contains('active'));
  assert.equal(document.getElementById('panel-dashboard').hidden, false);
});

test('headline metrics report published, unpublished and pending counts', async () => {
  const { document } = await bootDashboard();

  assert.equal(metricByLabel(document, 'Articles published').querySelector('.metric-value').textContent, '8');
  assert.equal(metricByLabel(document, 'Unpublished').querySelector('.metric-value').textContent, '4');
  assert.equal(metricByLabel(document, 'Pending approval').querySelector('.metric-value').textContent, '1');
  assert.equal(metricByLabel(document, 'Articles read').querySelector('.metric-value').textContent, '340');
  assert.equal(metricByLabel(document, 'Reactions').querySelector('.metric-value').textContent, '46');
  assert.equal(metricByLabel(document, 'Comments').querySelector('.metric-value').textContent, '18');
  assert.equal(metricByLabel(document, 'Registered authors').querySelector('.metric-value').textContent, '2');
});

test('period comparison shows direction, and stays silent without a baseline', async () => {
  const { document } = await bootDashboard();

  const reads = metricByLabel(document, 'Articles read').querySelector('.metric-delta');
  assert.ok(reads.classList.contains('up'));
  assert.match(reads.textContent, /20% vs previous period/);

  const comments = metricByLabel(document, 'Comments').querySelector('.metric-delta');
  assert.ok(comments.classList.contains('down'));
  assert.match(comments.textContent, /20% vs previous period/);

  // Growth from an empty previous window has no meaningful percentage, so the
  // card must state the raw figure rather than invent a change.
  const reactions = metricByLabel(document, 'Reactions').querySelector('.metric-delta');
  assert.ok(reactions.classList.contains('neutral'));
  assert.match(reactions.textContent, /12 this period/);
});

test('the author table lists every registered author and their output', async () => {
  const { document } = await bootDashboard();
  const rows = [...document.querySelectorAll('#authorTableBody tr')];
  assert.equal(rows.length, 2);

  const cells = [...rows[0].children].map((cell) => cell.textContent.trim());
  assert.match(cells[0], /Oluwashola Busari/);
  assert.deepEqual(cells.slice(1), ['7', '1', '1', '300', '40', '15']);

  // An author who uploaded a photo shows it; one who has not falls back to initials.
  assert.ok(rows[0].querySelector('.author-avatar img'), 'photo shown for the author who has one');
  assert.equal(rows[1].querySelector('.author-avatar img'), null);
  assert.equal(rows[1].querySelector('.author-avatar').textContent, 'AE');
});

test('most-read articles are listed with their engagement', async () => {
  const { document } = await bootDashboard();
  const rows = [...document.querySelectorAll('#topArticleBody tr')];
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /Alpha story/);
  assert.deepEqual([...rows[0].children].slice(1).map((c) => c.textContent), ['200', '150', '20', '9']);
});

test('articles with no reads yet produce an explanatory empty state', async () => {
  const overview = sampleOverview({
    topArticles: [
      { slug: 'a', title: 'Alpha', category: 'Technology', status: 'published', author: 'A', authorSlug: 'a', views: 0, readers: 0, likes: 0, dislikes: 0, comments: 0 }
    ]
  });
  const { document } = await bootDashboard({ overview });
  const empty = document.querySelector('#topArticleBody .table-empty');
  assert.ok(empty, 'an empty state is shown rather than a row of zeroes');
  assert.match(empty.textContent, /No reads recorded yet/);
});

test('the activity feed renders reader and editorial events', async () => {
  const { document } = await bootDashboard();
  const items = [...document.querySelectorAll('#activityFeed .activity-item')];
  assert.equal(items.length, 2);
  assert.ok(items[0].classList.contains('activity-item--comment'));
  assert.match(items[0].textContent, /Ada commented/);
  assert.match(items[0].querySelector('.activity-quote').textContent, /Very clear/);
  assert.ok(items[1].classList.contains('activity-item--like'));
});

test('comment text in the feed is escaped, never parsed as HTML', async () => {
  const overview = sampleOverview({
    activity: [
      { type: 'comment', at: '2026-08-16 11:59:00', title: 'Alpha', slug: 'a', detail: 'Mallory commented', body: '<img src=x onerror="window.compromised = true">' }
    ]
  });
  const { window, document } = await bootDashboard({ overview });
  assert.equal(window.compromised, undefined);
  assert.equal(document.querySelector('#activityFeed img'), null);
  assert.match(document.querySelector('.activity-quote').textContent, /<img src=x/);
});

test('metrics and tables still render when the chart library is unavailable', async () => {
  // The admin may be opened offline, or the CDN may be blocked. The numbers
  // must not disappear with the graphs.
  const { document } = await bootDashboard();
  assert.equal(document.querySelectorAll('#dashMetrics .metric-card').length, 7);
  assert.equal(document.querySelectorAll('#authorTableBody tr').length, 2);
  assert.match(document.getElementById('dashUpdated').textContent, /Charts unavailable offline/);
});

test('a failing chart cannot take down the rest of the dashboard', async () => {
  const Exploding = function Exploding() { throw new Error('canvas unavailable'); };
  const { document } = await bootDashboard({ chart: Exploding });

  assert.equal(document.querySelectorAll('#dashMetrics .metric-card').length, 7, 'metrics survived');
  assert.equal(document.querySelectorAll('#authorTableBody tr').length, 2, 'author table survived');
  assert.equal(document.querySelectorAll('#activityFeed .activity-item').length, 2, 'activity survived');
  assert.match(document.getElementById('dashUpdated').textContent, /Charts could not be drawn/);
});

test('the dashboard exposes a live-status indicator and period selector', async () => {
  const { document } = await bootDashboard();
  assert.ok(document.getElementById('dashLive'), 'live badge present');
  const range = document.getElementById('dashRange');
  assert.ok(range, 'period selector present');
  assert.deepEqual([...range.options].map((option) => option.value), ['7', '30', '90']);
  assert.equal(range.value, '30');
});
