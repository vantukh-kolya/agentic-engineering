import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeHome } from './lib/claude/index.js';
import { getSource, listSources } from './lib/sources.js';
import { layout } from './views/layout.js';
import { sessionsView } from './views/sessions.js';

const here = dirname(fileURLToPath(import.meta.url));
export const app = express();

app.use(express.static(join(here, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, sources: listSources(), claudeHome: claudeHome() });
});

function queryLimit(originalUrl) {
  const values = new URL(originalUrl, 'http://127.0.0.1').searchParams.getAll('limit');
  if (!values.length) return 50;
  if (values.length !== 1 || !values[0] || /[^0-9]/.test(values[0])) return null;
  const limit = Number(values[0]);
  return limit >= 1 && limit <= 1000 ? limit : null;
}

app.get('/', (req, res) => {
  const source = getSource('claude');
  const page = model => layout({
    title: 'agent-ops', body: sessionsView(model), source: source.label, home: source.home(),
  });
  const limit = queryLimit(req.originalUrl);
  if (limit === null) {
    return res.status(400).type('html').send(page({ state: 'invalid-limit' }));
  }
  const result = source.listSessions();
  if (result.state === 'unavailable') {
    return res.status(503).type('html').send(page({
      ...result, limit, visibleCount: null, availableCount: null, totalCount: null,
    }));
  }
  const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const sessions = result.sessions.toSorted((left, right) =>
    right.mtimeMs - left.mtimeMs || compareText(left.projectKey, right.projectKey) || compareText(left.id, right.id)
  ).slice(0, limit);
  res.type('html').send(page({
    ...result,
    sessions,
    limit,
    visibleCount: sessions.length,
    availableCount: result.sessions.length,
    totalCount: result.state === 'complete' ? result.sessions.length : null,
  }));
});

const PORT = Number(process.env.PORT || 4180);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`agent-ops on http://127.0.0.1:${PORT}  (CLAUDE_HOME=${claudeHome()})`);
  });
}
