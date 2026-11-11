import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../views/layout.js';
import { sessionsView } from '../views/sessions.js';

const row = { id: 'complete-session-id', projectKey: '-work-api-service', projectPath: '/work/api/service', sizeBytes: 12345, mtimeMs: Date.UTC(2026, 1, 3, 4, 5, 6) };
function render(overrides = {}) {
  return sessionsView({
    state: 'complete', sessions: [row], limit: 50, visibleCount: 1,
    availableCount: 1, totalCount: 1, skippedProjects: 0, skippedFiles: 0, ...overrides,
  });
}

test('session rows contain full identifiers, exact bytes, UTC and distinguishable derived projects', () => {
  const html = render({ sessions: [row, { ...row, id: 'second', projectKey: 'another-key' }] });
  for (const value of [row.id, row.projectKey, row.projectPath, '12345', '2026-02-03T04:05:06.000Z', 'похідний', 'another-key']) {
    assert.ok(html.includes(value), value);
  }
  assert.match(html, /<time datetime="2026-02-03T04:05:06.000Z">/);
  assert.equal((html.match(/<th scope="col"/g) ?? []).length, 4);
  assert.equal((html.match(/data-label=/g) ?? []).length, 8);
});

test('visible and available totals explain truncation and expose valid limit controls', () => {
  const html = render({ limit: 1, availableCount: 60, totalCount: 60 });
  assert.match(html, /Показано 1 із 60 сесій/);
  assert.match(html, /Ліміт: 1/);
  assert.match(html, /href="\/\?limit=60"/);
  assert.match(html, /href="\/\?limit=1" aria-current="true"/);
  for (const match of html.matchAll(/href="\/\?limit=(\d+)"/g)) {
    assert.ok(Number(match[1]) >= 1 && Number(match[1]) <= 1000);
  }
});

test('an inventory above 1000 never offers an out-of-range show-all link', () => {
  const html = render({ availableCount: 1001, totalCount: 1001 });
  assert.doesNotMatch(html, /limit=1001/);
  assert.match(html, /limit=1000/);
});

test('source text is escaped in text and quoted attributes', () => {
  const malicious = '"<img src=x onerror=alert(1)>&';
  const html = render({ sessions: [{ ...row, id: malicious, projectKey: malicious, projectPath: malicious }] });
  assert.doesNotMatch(html, /<img|onerror="|title=""/);
  assert.ok(html.includes(`title="${esc(malicious)}"`));
  assert.ok(html.includes(`>${esc(malicious)}<`));
});

test('the view preserves the supplied row order and does not mutate the model', () => {
  const rows = Object.freeze([Object.freeze({ ...row, id: 'z' }), Object.freeze({ ...row, id: 'a' })]);
  const html = render({ sessions: rows });
  assert.ok(html.indexOf('>z<') < html.indexOf('>a<'));
});
