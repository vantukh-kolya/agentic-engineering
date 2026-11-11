import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionsView } from '../views/sessions.js';

const row = { id: 'available-id', projectKey: '-project', projectPath: '/project', sizeBytes: 1, mtimeMs: 0 };
function render(overrides = {}) {
  return sessionsView({
    state: 'complete', sessions: [], limit: 50, visibleCount: 0, availableCount: 0,
    totalCount: 0, skippedProjects: 0, skippedFiles: 0, ...overrides,
  });
}

test('a complete empty inventory is the only successful empty state', () => {
  const html = render();
  assert.match(html, /<p class="empty">Сесій поки немає<\/p>/);
  assert.match(html, /Показано 0 із 0 сесій/);
  assert.doesNotMatch(html, /<table|перелік неповний|невідома/);
});

test('partial inventories retain rows, separate skip counts and identify unknown source totals', () => {
  const html = render({ state: 'partial', sessions: [row], visibleCount: 1, availableCount: 3, totalCount: null, skippedProjects: 2, skippedFiles: 4, limit: 1 });
  assert.match(html, /available-id/);
  assert.match(html, /Показано 1 із 3 доступних сесій/);
  assert.match(html, /Загальна кількість сесій джерела невідома/);
  assert.match(html, /class="note"/);
  assert.match(html, /Пропущено проєктів: 2/);
  assert.match(html, /Пропущено файлів: 4/);
  assert.match(html, /перелік неповний/);
  assert.match(html, /Ліміт: 1/);
  assert.doesNotMatch(html, /Сесій поки немає/);
});

test('no accessible projects is a partial result, not a complete empty result', () => {
  const html = render({ state: 'partial', totalCount: null, skippedProjects: 3 });
  assert.match(html, /<p class="empty">Доступних сесій не знайдено; перелік неповний<\/p>/);
  assert.match(html, /Показано 0 із 0 доступних сесій/);
  assert.match(html, /Загальна кількість сесій джерела невідома/);
  assert.match(html, /Пропущено проєктів: 3/);
  assert.match(html, /Пропущено файлів: 0/);
  assert.doesNotMatch(html, /<table|Сесій поки немає/);
});

for (const [state, message] of [
  ['unavailable', 'Не вдалося прочитати джерело сесій'],
  ['invalid-limit', 'Ліміт має бути цілим числом від 1 до 1000'],
]) {
  test(`${state} exposes its explanation without a table or successful zero counts`, () => {
    const html = render({ state, diagnostic: 'Error: synthetic stack' });
    assert.ok(html.includes(message));
    assert.doesNotMatch(html, /<table|Показано|Сесій поки немає|synthetic|Error:|stack|limit=/);
  });
}
