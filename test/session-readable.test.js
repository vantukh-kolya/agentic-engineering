import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionsView } from '../views/sessions.js';
import { layout, esc } from '../views/layout.js';

test('long metadata remains complete and labelled in both table and narrow-screen markup', () => {
  const id = 'session-' + 'long-identifier-'.repeat(20);
  const projectKey = '-Users-synthetic-' + 'long-project-'.repeat(20);
  const projectPath = projectKey.replaceAll('-', '/');
  const home = '/synthetic/' + 'long-home-'.repeat(30);
  const html = layout({ title: 'agent-ops', source: 'Claude Code', home, body: sessionsView({
    state: 'complete', sessions: [{ id, projectKey, projectPath, sizeBytes: 987654321, mtimeMs: 0 }],
    limit: 50, visibleCount: 1, availableCount: 1, totalCount: 1, skippedProjects: 0, skippedFiles: 0,
  }) });
  for (const value of [id, projectKey, projectPath, home, '987654321', '1970-01-01T00:00:00.000Z']) {
    assert.ok(html.includes(esc(value)), 'Full metadata must remain in the rendered document');
  }
  assert.equal((html.match(/data-label=/g) ?? []).length, 4);
  assert.match(html, /\(похідний\)/);
  assert.match(html, /data-theme-toggle/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
});
