'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

const TASKS = [
  { id: '1', title: 'Buy groceries', priority: 'low' },
  { id: '2', title: 'Schedule dentist appointment', priority: 'medium' },
  { id: '3', title: 'Submit quarterly report', priority: 'high' },
  { id: '4', title: 'Fix production bug', priority: 'high' },
];

// Loads the real page with its inline script, serving GET /tasks from `tasks`.
// Closing the window after each test lets the runner exit promptly.
async function loadPage(t, tasks = TASKS) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    beforeParse(window) {
      window.fetch = async () => ({ ok: true, status: 200, json: async () => tasks });
    },
  });
  t.after(() => dom.window.close());
  await flush();
  return dom.window.document;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function filterButton(document, filter) {
  return document.querySelector(`.filter-btn[data-filter="${filter}"]`);
}

function visibleTitles(document) {
  return [...document.querySelectorAll('.task-title')].map((el) => el.textContent);
}

test('renders the four filter buttons in order', async (t) => {
  const document = await loadPage(t);
  const labels = [...document.querySelectorAll('.filter-btn')].map((b) => b.textContent);
  assert.deepEqual(labels, ['All', 'High', 'Medium', 'Low']);
});

test('All is selected by default and shows every task', async (t) => {
  const document = await loadPage(t);
  const all = filterButton(document, 'all');
  assert.ok(all.classList.contains('active'));
  assert.equal(all.getAttribute('aria-pressed'), 'true');
  assert.equal(visibleTitles(document).length, TASKS.length);
});

for (const priority of ['high', 'medium', 'low']) {
  test(`clicking ${priority} shows only ${priority} tasks`, async (t) => {
    const document = await loadPage(t);
    filterButton(document, priority).click();

    const expected = TASKS.filter((task) => task.priority === priority).map((task) => task.title);
    assert.deepEqual(visibleTitles(document), expected);
  });
}

test('selected state and aria-pressed move to the clicked button only', async (t) => {
  const document = await loadPage(t);
  filterButton(document, 'medium').click();

  for (const btn of document.querySelectorAll('.filter-btn')) {
    const isMedium = btn.dataset.filter === 'medium';
    assert.equal(btn.classList.contains('active'), isMedium);
    assert.equal(btn.getAttribute('aria-pressed'), String(isMedium));
  }
});

test('clicking All after a filter restores every task', async (t) => {
  const document = await loadPage(t);
  filterButton(document, 'low').click();
  filterButton(document, 'all').click();
  assert.equal(visibleTitles(document).length, TASKS.length);
});

test('shows the empty state when no task matches the filter', async (t) => {
  const document = await loadPage(t, TASKS.filter((task) => task.priority !== 'low'));
  filterButton(document, 'low').click();
  assert.equal(visibleTitles(document).length, 0);
  assert.ok(document.querySelector('.empty-state'));
});
